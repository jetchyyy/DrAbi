declare module 'qrcode' {
  interface QRCodeToStringOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    type?: 'svg' | 'terminal' | 'utf8';
    width?: number;
  }

  const QRCode: {
    toString(text: string, options?: QRCodeToStringOptions): Promise<string>;
  };

  export default QRCode;
}

