import { AlertCircle, Camera, CircleDashed, CreditCard, Printer, QrCode, Search, ShoppingCart, Smartphone, StopCircle, Trash2, UserRound } from 'lucide-react';
import jsQR from 'jsqr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { queryKeys } from '../../lib/query-keys';
import { printHtmlDocument } from '../../lib/print';
import { checkoutPosSaleLiveOrDemo, createInventoryLogs, listInventoryItemsLiveOrDemo, listPatientsLiveOrDemo, listPosSalesLiveOrDemo } from '../../lib/supabase-clinic';
import { formatCurrency } from '../../lib/utils';
import type { InventoryItem, PosPaymentMethod } from '../../types/domain';
import { useAuth } from '../auth/auth-context';
import { extractInventoryItemQrCode } from '../inventory/inventory-qr';

function readQrFromVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return '';
  }

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return '';
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  return decoded?.data?.trim() ?? '';
}

type CartEntry = {
  item: InventoryItem;
  quantity: number;
};

type ReceiptState = {
  saleNumber: string;
  customerName: string;
  paymentMethod: PosPaymentMethod;
  paymentReference: string | null;
  total: number;
  items: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
} | null;

const paymentOptions: Array<{ value: PosPaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
];

export function PosPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [lookupValue, setLookupValue] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [patientId, setPatientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [receiptState, setReceiptState] = useState<ReceiptState>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: [queryKeys.inventory, 'pos'],
    queryFn: () => listInventoryItemsLiveOrDemo(),
  });

  const { data: patients = [] } = useQuery({
    queryKey: queryKeys.patients,
    queryFn: () => listPatientsLiveOrDemo(),
  });

  const { data: sales = [] } = useQuery({
    queryKey: queryKeys.posSales,
    queryFn: () => listPosSalesLiveOrDemo(),
  });

  const recentSale = useMemo(() => sales.find((sale) => sale.id === lastReceiptId) ?? null, [lastReceiptId, sales]);

  const normalizedLookupCode = useMemo(() => {
    const extracted = extractInventoryItemQrCode(lookupValue);
    return (extracted || lookupValue).trim().toUpperCase();
  }, [lookupValue]);

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, entry) => sum + entry.quantity * entry.item.sellingPrice, 0),
    [cart],
  );

  const cartCount = useMemo(() => cart.reduce((sum, entry) => sum + entry.quantity, 0), [cart]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraState((current) => (current === 'unsupported' ? current : 'idle'));
    setCameraMessage('');
  };

  useEffect(
    () => () => {
      stopCamera();
    },
    [],
  );

  useEffect(() => {
    if (cameraState !== 'active' || !videoRef.current || !canvasRef.current) {
      return;
    }

    let cancelled = false;

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !canvasRef.current) {
        return;
      }

      try {
        const rawValue = readQrFromVideoFrame(videoRef.current, canvasRef.current);
        const code = extractInventoryItemQrCode(rawValue);
        if (code) {
          setLookupValue(rawValue);
          handleAddByCode(code);
          stopCamera();
          return;
        }
      } catch {
        setCameraMessage('Camera is active. Align the inventory QR inside the frame.');
      }

      window.setTimeout(scanFrame, 450);
    };

    void scanFrame();

    return () => {
      cancelled = true;
    };
  }, [cameraState, items]);

  useEffect(() => {
    if (cameraState !== 'requesting' && cameraState !== 'active') {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraMessage('Camera is ready. Tap Start camera again if preview does not appear.');
    });
  }, [cameraState]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error('You must be signed in to process a POS sale.');
      }

      if (cart.length === 0) {
        throw new Error('Add at least one item to the cart before checkout.');
      }

      if ((paymentMethod === 'gcash' || paymentMethod === 'card') && !paymentReference.trim()) {
        throw new Error('Reference details are required for GCash and card payments.');
      }

      if(!scannedItem){
        throw new Error('No item scanned')
      }
      const entry = cart.find(e => e.item.id === scannedItem.id);
      if (!entry) {
        throw new Error("Scanned item not found in cart");
      } 

      const payload = {
        patientId: patientId,
        appointmentId: null,
        itemId: scannedItem.id,
        quantity: entry.quantity,
        notes: paymentNotes.trim() || null,
        scannedCode: scannedItem.qrCode,
        recordedBy: profile.id,
      };

      try {
        const inventoryLogs = await createInventoryLogs(payload);
        console.log("SUCCESS:", inventoryLogs);
      } catch (err: any) {
        throw err;
      }

    
      return checkoutPosSaleLiveOrDemo({
        patientId: patientId || null,
        cashierId: profile.id,
        paymentMethod,
        paymentReference: paymentReference.trim() || null,
        paymentNotes: paymentNotes.trim() || null,
        items: cart.map((entry) => ({
          inventoryItemId: entry.item.id,
          quantity: entry.quantity,
          unitPrice: entry.item.sellingPrice,
        })),
      });
    },
   
    

    onSuccess: async (result) => {
      setCart([]);
      setLookupValue('');
      setLookupError('');
      setPaymentReference('');
      setPaymentNotes('');
      setPatientId('');
      setLastReceiptId(result.sale?.id ?? null);
      setReceiptState(
        result.sale
          ? {
              saleNumber: result.sale.saleNumber,
              customerName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Walk-in customer',
              paymentMethod: result.sale.paymentMethod,
              paymentReference: result.sale.paymentReference ?? null,
              total: result.sale.total,
              items: result.items.map((entry) => ({
                itemName: entry.itemName,
                quantity: entry.quantity,
                unitPrice: entry.unitPrice,
                lineTotal: entry.lineTotal,
              })),
            }
          : null,
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      await queryClient.invalidateQueries({ queryKey: queryKeys.posSales });
      await queryClient.invalidateQueries({queryKey:queryKeys.inventoryUsageLogs})
      toast.success('POS sale completed and stock updated.');
    },
  });

  function handleAddByCode(codeOverride?: string) {
    const code = (codeOverride ?? normalizedLookupCode).trim().toUpperCase();
    if (!code) {
      setLookupError('Type an item SKU or scan an inventory QR code.');
      return;
    }

    const matchedItem = items.find((item) => item.qrCode === code || item.sku.trim().toUpperCase() === code) ?? null;
    if (!matchedItem) {
      setLookupError('No inventory item matched that SKU or QR code.');
      return;
    }
    setScannedItem(matchedItem)

    setCart((currentCart) => {
      const existingEntry = currentCart.find((entry) => entry.item.id === matchedItem.id);
      if (!existingEntry) {
        return [...currentCart, { item: matchedItem, quantity: 1 }];
      }

      if (existingEntry.quantity + 1 > matchedItem.stockOnHand) {
        setLookupError(`Only ${matchedItem.stockOnHand} ${matchedItem.unit} available for ${matchedItem.name}.`);
        return currentCart;
      }

      return currentCart.map((entry) =>
        entry.item.id === matchedItem.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
      );
    });

    setLookupError('');
    setLookupValue('');
  }

  function updateCartQuantity(itemId: string, nextQuantity: number) {
    setCart((currentCart) =>
      currentCart.flatMap((entry) => {
        if (entry.item.id !== itemId) {
          return [entry];
        }

        if (nextQuantity <= 0) {
          return [];
        }

        if (nextQuantity > entry.item.stockOnHand) {
          toast.error(`Only ${entry.item.stockOnHand} ${entry.item.unit} available for ${entry.item.name}.`);
          return [entry];
        }

        return [{ ...entry, quantity: nextQuantity }];
      }),
    );
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setCameraMessage('This device or browser does not support camera access.');
      return;
    }

    stopCamera();
    setCameraState('requesting');
    setCameraMessage('Requesting camera permission...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState('active');
      setCameraMessage('Camera ready. Point it at the item QR code.');
    } catch {
      setCameraState('denied');
      setCameraMessage('Camera permission was denied. You can still type the SKU or QR value manually.');
    }
  }

  function handleLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAddByCode();
  }

  const selectedPatient = patients.find((patient) => patient.id === patientId) ?? null;
  const customerDisplayName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Walk-in customer';
  const paymentReferenceRequired = paymentMethod === 'gcash' || paymentMethod === 'card';
  const cameraStatusLabel = useMemo(() => {
    if (cameraState === 'active') {
      return 'Camera active';
    }
    if (cameraState === 'requesting') {
      return 'Waiting for permission';
    }
    if (cameraState === 'denied') {
      return 'Permission denied';
    }
    if (cameraState === 'unsupported') {
      return 'Camera unsupported';
    }
    return 'Camera idle';
  }, [cameraState]);

  async function handlePrintReceipt() {
    if (!receiptState) {
      return;
    }

    const linesMarkup = receiptState.items
      .map(
        (entry) => `
          <tr>
            <td>${entry.itemName}</td>
            <td>${entry.quantity}</td>
            <td>${formatCurrency(entry.unitPrice)}</td>
            <td>${formatCurrency(entry.lineTotal)}</td>
          </tr>`,
      )
      .join('');

    await printHtmlDocument(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>POS Receipt</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
      .sheet { max-width: 720px; margin: 0 auto; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      p { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 14px; }
      .total { margin-top: 20px; font-size: 18px; font-weight: 700; text-align: right; }
    </style>
  </head>
  <body>
    <main class="sheet">
      <h1>Odyssey Clinic POS Receipt</h1>
      <p>Sale No.: ${receiptState.saleNumber}</p>
      <p>Customer: ${receiptState.customerName}</p>
      <p>Payment: ${receiptState.paymentMethod.toUpperCase()}</p>
      <p>Reference: ${receiptState.paymentReference || 'N/A'}</p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>${linesMarkup}</tbody>
      </table>
      <p class="total">Total: ${formatCurrency(receiptState.total)}</p>
    </main>
  </body>
</html>`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Point of Sale</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <CircleDashed className="size-3.5" />
              {cameraStatusLabel}
            </span>
          </div>
          <CardTitle className="mt-2 text-3xl">Inventory-based cashier checkout</CardTitle>
          <p className="mt-3 max-w-3xl text-sm text-slate-500">
            Add items by SKU, external scanner input, or built-in QR camera scan. Checkout saves the sale and deducts stock immediately.
          </p>
          <div className="mt-5 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-3">
            <p><span className="font-semibold text-slate-800">1.</span> Scan or type item code</p>
            <p><span className="font-semibold text-slate-800">2.</span> Review cart quantities</p>
            <p><span className="font-semibold text-slate-800">3.</span> Complete payment and print receipt</p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleLookupSubmit}>
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-3">
                <Button className="gap-2" onClick={() => void startCamera()} type="button">
                  <Camera className="size-4" />
                  {cameraState === 'active' ? 'Restart camera' : 'Allow camera and scan'}
                </Button>
                {cameraState === 'active' ? (
                  <Button className="gap-2" onClick={stopCamera} type="button" variant="secondary">
                    <StopCircle className="size-4" />
                    Stop camera
                  </Button>
                ) : null}
              </div>
              {cameraMessage ? <p className="text-sm text-slate-600">{cameraMessage}</p> : null}
              {cameraState === 'requesting' || cameraState === 'active' ? (
                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-black">
                  <video className="aspect-video w-full object-cover opacity-90" muted playsInline ref={videoRef} />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-2xl border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                  </div>
                  <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-slate-100">
                    Keep item QR inside the frame
                  </p>
                  <canvas className="hidden" ref={canvasRef} />
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">SKU or QR code</span>
              <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <QrCode className="size-5 text-slate-400" />
                  <Input
                    className="border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                    onChange={(event) => setLookupValue(event.target.value)}
                    placeholder="Scan from external device or type SKU / QR value"
                    value={lookupValue}
                  />
                </div>
                <Button className="gap-2 sm:self-stretch" type="submit">
                  <Search className="size-4" />
                  Add item
                </Button>
                <Button
                  className="gap-2 sm:self-stretch"
                  onClick={() => {
                    setLookupValue('');
                    setLookupError('');
                  }}
                  type="button"
                  variant="secondary"
                >
                  Clear
                </Button>
              </div>
            </label>

            {lookupError ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{lookupError}</p>
              </div>
            ) : null}
          </form>
        </Card>

        <Card className="bg-slate-950 text-white">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Sale Summary</p>
          <CardTitle className="mt-2 text-white">Current cart snapshot</CardTitle>
          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Items</p>
              <p className="mt-2 text-3xl font-extrabold text-white">{cartCount}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Subtotal</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-300">{formatCurrency(cartSubtotal)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Customer</p>
              <p className="mt-2 text-base font-bold text-white">{customerDisplayName}</p>
            </div>
          </div>

          {recentSale ? (
            <div className="mt-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-200">Last completed sale</p>
              <p className="mt-2 text-lg font-bold text-white">{recentSale.saleNumber}</p>
              <p className="mt-1 text-sm text-slate-300">{formatCurrency(recentSale.total)} via {recentSale.paymentMethod.toUpperCase()}</p>
              {receiptState ? (
                <Button className="mt-4 gap-2" onClick={() => void handlePrintReceipt()} type="button" variant="secondary">
                  <Printer className="size-4" />
                  Print receipt
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Cart</p>
              <CardTitle className="mt-2">Items ready for checkout</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                <ShoppingCart className="size-4" />
                {cart.length} line{cart.length !== 1 ? 's' : ''}
              </div>
              <Button
                className="rounded-2xl px-3 py-2 text-xs font-semibold"
                disabled={cart.length === 0}
                onClick={() => setCart([])}
                type="button"
                variant="secondary"
              >
                Clear cart
              </Button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Item</th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Stock</th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Qty</th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Price</th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Line Total</th>
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={6}>
                      Scan or type an inventory item to start the sale.
                    </td>
                  </tr>
                ) : (
                  cart.map((entry) => (
                    <tr key={entry.item.id}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-950">{entry.item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{entry.item.sku} - {entry.item.unit}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            entry.item.stockOnHand <= entry.item.reorderLevel
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {entry.item.stockOnHand} available
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Input
                          className="max-w-24"
                          min="1"
                          max={entry.item.stockOnHand}
                          type="number"
                          value={entry.quantity}
                          onChange={(event) => updateCartQuantity(entry.item.id, Number(event.target.value))}
                        />
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">{formatCurrency(entry.item.sellingPrice)}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">{formatCurrency(entry.item.sellingPrice * entry.quantity)}</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:underline"
                          onClick={() => setCart((currentCart) => currentCart.filter((cartEntry) => cartEntry.item.id !== entry.item.id))}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Checkout</p>
          <CardTitle className="mt-2">Customer and payment details</CardTitle>

          <div className="mt-6 space-y-5">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600 sm:grid-cols-2">
              <p>
                Customer: <span className="text-slate-900">{customerDisplayName}</span>
              </p>
              <p>
                Payment mode: <span className="text-slate-900 uppercase">{paymentMethod}</span>
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Customer</label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <UserRound className="size-5 text-slate-400" />
                <Select value={patientId} onChange={(event) => setPatientId(event.target.value)}>
                  <option value="">Walk-in customer</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Payment method</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {paymentOptions.map((option) => {
                  const isActive = paymentMethod === option.value;
                  const Icon = option.value === 'cash' ? ShoppingCart : option.value === 'gcash' ? Smartphone : CreditCard;
                  return (
                    <button
                      key={option.value}
                      className={`rounded-3xl border px-4 py-4 text-left transition ${isActive ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      onClick={() => setPaymentMethod(option.value)}
                      type="button"
                    >
                      <Icon className="size-5" />
                      <p className="mt-3 font-bold">{option.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {paymentMethod === 'cash' ? 'Cash notes' : 'Reference / payment details'}
                {paymentReferenceRequired ? <span className="ml-1 text-rose-600">*</span> : null}
              </label>
              <Input
                placeholder={paymentMethod === 'cash' ? 'Optional cashier note' : 'Required reference number or payment details'}
                value={paymentMethod === 'cash' ? paymentNotes : paymentReference}
                onChange={(event) => {
                  if (paymentMethod === 'cash') {
                    setPaymentNotes(event.target.value);
                    return;
                  }
                  setPaymentReference(event.target.value);
                }}
              />
              {paymentReferenceRequired ? (
                <p className="mt-2 text-xs text-slate-500">Reference is required for {paymentMethod.toUpperCase()} payments.</p>
              ) : null}
            </div>

            {paymentMethod !== 'cash' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Additional notes</label>
                <Input placeholder="Optional note for this payment" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600">Subtotal</p>
                <p className="text-lg font-extrabold text-slate-950">{formatCurrency(cartSubtotal)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600">Payment method</p>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-950">{paymentMethod}</p>
              </div>
            </div>

            <Button className="w-full gap-2" disabled={checkoutMutation.isPending || cart.length === 0} onClick={() => checkoutMutation.mutate()} type="button">
              <ShoppingCart className="size-4" />
              {checkoutMutation.isPending ? 'Processing sale...' : `Complete sale (${formatCurrency(cartSubtotal)})`}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
