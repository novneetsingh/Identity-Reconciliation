import prisma from "../config/prisma";
import { Request, Response } from "express";
import { Contact, LinkPrecedence } from "../generated/prisma/client";

/*
  Cases handled:
  1. No existing contact - Create new primary contact
  2. One or more matches found - Identify the true primary
  3. New information for existing group - Create secondary contact
  4. Multiple primary groups found - Consolidate/merge them
*/
export const identify = async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body as {
      email: string;
      phoneNumber: string;
    };

    if (!email && !phoneNumber) {
      return res.status(400).json({
        message: "At least one of email or phoneNumber is required",
      });
    }

    // 1. Find all contacts that directly match the request
    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          email ? { email } : undefined,
          phoneNumber ? { phoneNumber } : undefined,
        ].filter(Boolean) as any,
        deletedAt: null,
      },
    });

    // ----------------------------------------------------------------
    // Case 1️⃣: No matching contacts. Create a new primary contact.
    // ----------------------------------------------------------------
    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.primary,
        },
      });

      return res.status(200).json(formatResponse([newContact]));
    }

    // ----------------------------------------------------------------
    // Case 2️⃣ & 4️⃣: Matches found. Identify all related primary contacts.
    // ----------------------------------------------------------------

    // Collect all primary IDs linked to our matches
    const relatedPrimaryIds: Set<number> = new Set();

    for (const contact of matchingContacts) {
      if (contact.linkPrecedence === LinkPrecedence.primary)
        relatedPrimaryIds.add(contact.id);
      else if (contact.linkedId) relatedPrimaryIds.add(contact.linkedId);
    }

    // Get all primary contacts from the set, ordered by creation date
    const allPrimaryContacts = await prisma.contact.findMany({
      where: {
        id: { in: [...relatedPrimaryIds] },
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    // The first one in the list is the true, oldest primary contact
    let truePrimaryContact = allPrimaryContacts[0] as Contact;

    const otherPrimaryContactIds: number[] = allPrimaryContacts
      .slice(1)
      .map((c) => c.id);

    // If we have more than one primary, we need to merge (Case 4️⃣)
    if (otherPrimaryContactIds.length > 0) {
      await Promise.all([
        // 1. Update the newer primary contacts to secondary
        prisma.contact.updateMany({
          where: { id: { in: otherPrimaryContactIds } },
          data: {
            linkedId: truePrimaryContact.id,
            linkPrecedence: LinkPrecedence.secondary,
          },
        }),

        // 2. Update all *their* children to point to the new primary
        prisma.contact.updateMany({
          where: { linkedId: { in: otherPrimaryContactIds } },
          data: {
            linkedId: truePrimaryContact.id,
          },
        }),
      ]);
    }

    // ----------------------------------------------------------------
    // Case 3️⃣: Check if we need to create a new secondary contact.
    // ----------------------------------------------------------------

    // First, get all contacts (primary + secondary) for the final group
    const allRelatedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: truePrimaryContact.id },
          { linkedId: truePrimaryContact.id },
        ],
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    // Check if the *information* is new to the group
    const hasNewEmail =
      email && !allRelatedContacts.some((contact) => contact.email === email);

    const hasNewPhone =
      phoneNumber &&
      !allRelatedContacts.some(
        (contact) => contact.phoneNumber === phoneNumber
      );

    let finalContactsList = allRelatedContacts;

    // We only create a new contact if:
    // 1. The request contains at least one piece of new information.
    // 2. AND the exact (email, phone) combination doesn't already exist.
    if (hasNewEmail || hasNewPhone) {
      // Check if this specific combination already exists
      const combinationExists = allRelatedContacts.some(
        (contact) =>
          contact.email === email && contact.phoneNumber === phoneNumber
      );

      if (!combinationExists) {
        const newSecondaryContact = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkedId: truePrimaryContact.id,
            linkPrecedence: LinkPrecedence.secondary,
          },
        });

        finalContactsList.push(newSecondaryContact);
      }
    }

    return res.status(200).json(formatResponse(finalContactsList));
  } catch (error: any) {
    console.error("Error in identify endpoint:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const formatResponse = (allRelatedContacts: Contact[]) => {
  // The first contact is always the primary, as we sorted by createdAt
  const primaryContact = allRelatedContacts[0] as Contact;

  // Get all unique emails and phone numbers, filtering out nulls
  const allEmails = [
    ...new Set(
      allRelatedContacts.map((c) => c.email).filter(Boolean) as string[]
    ),
  ];

  const allPhoneNumbers = [
    ...new Set(
      allRelatedContacts.map((c) => c.phoneNumber).filter(Boolean) as string[]
    ),
  ];

  // Ensure primary contact's info is first
  const sortedEmails = [
    primaryContact.email,
    ...allEmails.filter((e) => e !== primaryContact.email),
  ].filter(Boolean) as string[];

  const sortedPhoneNumbers = [
    primaryContact.phoneNumber,
    ...allPhoneNumbers.filter((p) => p !== primaryContact.phoneNumber),
  ].filter(Boolean) as string[];

  // Get all IDs *except* the primary contact's ID
  const secondaryContactIds = allRelatedContacts
    .filter((c) => c.id !== primaryContact.id)
    .map((c) => c.id);

  return {
    contact: {
      primaryContatctId: primaryContact.id,
      emails: sortedEmails,
      phoneNumbers: sortedPhoneNumbers,
      secondaryContactIds: secondaryContactIds,
    },
  };
};
