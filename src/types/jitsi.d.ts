interface JitsiMeetExternalApiOptions {
  roomName: string;
  parentNode: HTMLElement;
  width?: string | number;
  height?: string | number;
  userInfo?: {
    displayName?: string;
    email?: string;
  };
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

interface JitsiMeetExternalApiInstance {
  dispose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: JitsiMeetExternalApiOptions) => JitsiMeetExternalApiInstance;
  }
}

export {};
