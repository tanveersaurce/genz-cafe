export interface BillingSettings {
  gstEnabled: boolean; // DUMMY: confirm with cafe/CA
  pricesIncludeTax: boolean; // DUMMY: confirm with cafe/CA
  gstin: string; // DUMMY: confirm with cafe/CA
  legalName: string; // DUMMY: confirm with cafe/CA
  address: {
    line1: string; // DUMMY: confirm with cafe/CA
    line2?: string; // DUMMY: confirm with cafe/CA
    city: string; // DUMMY: confirm with cafe/CA
    state: string; // DUMMY: confirm with cafe/CA
    pincode: string; // DUMMY: confirm with cafe/CA
  };
  invoicePrefix: string; // DUMMY: confirm with cafe/CA
  financialYearStartMonth: number; // DUMMY: confirm with cafe/CA (4 for April in India)
  roundOffToRupee: boolean; // DUMMY: confirm with cafe/CA
}

export const billingSettings: BillingSettings = {
  gstEnabled: true, // DUMMY: confirm with cafe/CA
  pricesIncludeTax: true, // DUMMY: confirm with cafe/CA
  gstin: '00AAAAA0000A1Z5', // DUMMY: confirm with cafe/CA
  legalName: 'Gen-Z Cafe LLP', // DUMMY: confirm with cafe/CA
  address: {
    line1: 'Shop No. 00, Sample Plaza', // DUMMY: confirm with cafe/CA
    line2: 'Main Road', // DUMMY: confirm with cafe/CA
    city: 'Your City', // DUMMY: confirm with cafe/CA
    state: 'State', // DUMMY: confirm with cafe/CA
    pincode: '000000', // DUMMY: confirm with cafe/CA
  },
  invoicePrefix: 'GZ', // DUMMY: confirm with cafe/CA
  financialYearStartMonth: 4, // DUMMY: confirm with cafe/CA
  roundOffToRupee: true, // DUMMY: confirm with cafe/CA
};
