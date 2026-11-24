// Specs keyed by their PMM-T id skip when the running server is below this version.
export const minPmmVersion: Record<string, string> = {
  'PMM-T1090': '3.8.0',
  'PMM-T2029': '3.10.0',
  'PMM-T2049': '3.10.0',
  'PMM-T2202': '3.10.0',
  'PMM-T2252': '3.10.0',
  'PMM-T2262': '3.10.0',
  'PMM-T2263': '3.10.0',
  'PMM-T2265': '3.10.0',
  'PMM-T2266': '3.10.0',
  'PMM-T2267': '3.10.0',
  'PMM-T2268': '3.10.0',
  'PMM-T2354': '3.10.0',
  'PMM-T2355': '3.10.0',
  'PMM-T2356': '3.10.0',
  'PMM-T2369': '3.10.0',
  'PMM-T2370': '3.10.0',
  'PMM-T2479': '3.11.1',
  'PMM-T2480': '3.11.1',
  'PMM-T2481': '3.11.1',
  'PMM-T2482': '3.11.1',
  'PMM-T2483': '3.11.1',
  'PMM-T2486': '3.11.1',
  'PMM-T2514': '3.11.0',
  'PMM-T2616': '3.11.0',
  'PMM-T2622': '3.11.0',
  'PMM-T2623': '3.11.0',
  'PMM-T2624': '3.11.0',
  'PMM-T2625': '3.11.0',
  'PMM-T2627': '3.11.0',
};

// Left menu items, by selectMenuItem path, that PMM-T2202 skips when the running server is below this version.
export const menuItemMinPmmVersion: Record<string, string> = {
  'mongodb.searchDetails': '3.11.1',
  'mongodb.searchHealth': '3.11.1',
};
