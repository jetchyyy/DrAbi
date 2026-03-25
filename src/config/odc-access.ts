export const odcAccessConfig = {
  route: '/odc',
  sessionAccessKey: 'odyssey-odc-access-key',
  acceptedFileExtensions: '.json,.key,.txt',
  demoAccessKey: import.meta.env.VITE_ODC_DEMO_ACCESS_KEY || 'CHANGE_THIS_LOCAL_ODC_KEY',
} as const;
