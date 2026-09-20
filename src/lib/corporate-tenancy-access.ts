export function canManageCorporateOccupants(input: {
  actorRole: "LANDLORD" | "TENANT" | "ADMIN";
  isAuthorizedSignatory: boolean;
}): boolean {
  return input.actorRole === "LANDLORD" || input.isAuthorizedSignatory;
}

export function canLegallySignCorporateAgreement(input: {
  leasePartyType: "INDIVIDUAL" | "CORPORATE";
  isAuthorizedSignatory: boolean;
}): boolean {
  if (input.leasePartyType === "INDIVIDUAL") {
    return true;
  }

  return input.isAuthorizedSignatory;
}
