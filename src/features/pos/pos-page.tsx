import {
  AlertCircle,
  Camera,
  CircleDashed,
  CreditCard,
  Printer,
  QrCode,
  Search,
  ShoppingCart,
  Smartphone,
  StopCircle,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import jsQR from "jsqr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { queryKeys } from "../../lib/query-keys";
import { printHtmlDocument } from "../../lib/print";
import {
  checkoutPosSaleLiveOrDemo,
  createInventoryLogs,
  getDoctorDirectoryLiveOrDemo,
  listConsultationsByPatientIdLiveOrDemo,
  listInventoryItemsLiveOrDemo,
  listPatientsLiveOrDemo,
  listPosSalesLiveOrDemo,
  listUsersLiveOrDemo,
} from "../../lib/supabase-clinic";
import { formatCurrency } from "../../lib/utils";
import type { InventoryItem, PosPaymentMethod } from "../../types/domain";
import { useAuth } from "../auth/auth-context";
import { extractInventoryItemQrCode } from "../inventory/inventory-qr";
import { buildPosReceiptPrintDocument } from "./pos-receipt-print-document";

function readQrFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
) {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return "";
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return "";
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });

  return decoded?.data?.trim() ?? "";
}

type CartEntry = {
  item: InventoryItem;
  quantity: number;
};

type ReceiptState = {
  saleNumber: string;
  customerName: string;
  doctorAssignedName: string;
  receptionistName: string;
  paymentMethod: PosPaymentMethod;
  paymentReference: string | null;
  issuedAt: string;
  subtotal: number;
  total: number;
  items: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
} | null;

const paymentOptions: Array<{ value: PosPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "card", label: "Card" },
];

function normalizeInventoryLookupQuery(query: string) {
  const trimmed = query.trim();
  const extracted = extractInventoryItemQrCode(trimmed);

  return {
    trimmed,
    exactCode: (extracted || trimmed).trim().toUpperCase(),
    searchTerm: trimmed.toLowerCase(),
  };
}

function findInventoryLookupMatches(items: InventoryItem[], query: string) {
  const { trimmed, exactCode, searchTerm } =
    normalizeInventoryLookupQuery(query);

  if (!trimmed) {
    return [];
  }

  const exactMatches = items.filter((item) => {
    return (
      item.qrCode.trim().toUpperCase() === exactCode ||
      item.sku.trim().toUpperCase() === exactCode ||
      item.name.trim().toLowerCase() === searchTerm
    );
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return items.filter((item) => {
    return [item.name, item.sku, item.unit, item.qrCode]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);
  });
}

function formatDoctorSignatureName(
  doctorName: string | null | undefined,
  postNominals?: string | null,
) {
  const baseName = (doctorName ?? "").trim().replace(/^dr\.?\s+/i, "").trim();
  if (!baseName) {
    return "N/A";
  }

  const suffix = (postNominals ?? "")
    .trim()
    .replace(/^,\s*/, "")
    .replace(/^dr\.?\s+/i, "");

  return suffix ? `Dr. ${baseName}, ${suffix}` : `Dr. ${baseName}`;
}

export function PosPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [lookupValue, setLookupValue] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [pendingItem, setPendingItem] = useState<InventoryItem | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState("1");
  const [patientId, setPatientId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [cameraState, setCameraState] = useState<
    "idle" | "requesting" | "active" | "unsupported" | "denied"
  >("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [receiptState, setReceiptState] = useState<ReceiptState>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: [queryKeys.inventory, "pos"],
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

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users,
    queryFn: () => listUsersLiveOrDemo(),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: queryKeys.doctors,
    queryFn: () => getDoctorDirectoryLiveOrDemo(),
  });

  const lookupMatches = useMemo(
    () => findInventoryLookupMatches(items, lookupValue),
    [items, lookupValue],
  );

  const filteredPatients = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return patients;
    }

    return patients.filter((patient) => {
      const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
      return fullName.includes(query);
    });
  }, [customerSearch, patients]);

  const hasLookupMatches =
    lookupValue.trim().length > 0 && lookupMatches.length > 0;

  const recentSale = useMemo(
    () => sales.find((sale) => sale.id === lastReceiptId) ?? null,
    [lastReceiptId, sales],
  );

  const cartSubtotal = useMemo(
    () =>
      cart.reduce(
        (sum, entry) => sum + entry.quantity * entry.item.sellingPrice,
        0,
      ),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, entry) => sum + entry.quantity, 0),
    [cart],
  );

  const addItemToCart = useCallback((matchedItem: InventoryItem, quantity = 1) => {
    setCart((currentCart) => {
      const existingEntry = currentCart.find(
        (entry) => entry.item.id === matchedItem.id,
      );
      if (!existingEntry) {
        if (quantity > matchedItem.stockOnHand) {
          setLookupError(
            `Only ${matchedItem.stockOnHand} ${matchedItem.unit} available for ${matchedItem.name}.`,
          );
          return currentCart;
        }
        return [...currentCart, { item: matchedItem, quantity }];
      }

      if (existingEntry.quantity + quantity > matchedItem.stockOnHand) {
        setLookupError(
          `Only ${matchedItem.stockOnHand} ${matchedItem.unit} available for ${matchedItem.name}.`,
        );
        return currentCart;
      }

      return currentCart.map((entry) =>
        entry.item.id === matchedItem.id
          ? { ...entry, quantity: entry.quantity + quantity }
          : entry,
      );
    });

    setLookupError("");
    setLookupValue("");
  }, []);

  const openQuantityModal = useCallback((item: InventoryItem) => {
    setPendingItem(item);
    setPendingQuantity("1");
    setLookupError("");
  }, []);

  const closeQuantityModal = useCallback(() => {
    setPendingItem(null);
    setPendingQuantity("1");
  }, []);

  const confirmAddQuantity = useCallback(() => {
    if (!pendingItem) {
      return;
    }

    const quantity = Number(pendingQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setLookupError("Enter a valid whole number quantity.");
      return;
    }

    if (quantity > pendingItem.stockOnHand) {
      setLookupError(
        `Only ${pendingItem.stockOnHand} ${pendingItem.unit} available for ${pendingItem.name}.`,
      );
      return;
    }

    addItemToCart(pendingItem, quantity);
    closeQuantityModal();
  }, [addItemToCart, closeQuantityModal, pendingItem, pendingQuantity]);

  const handleAddByCode = useCallback(
    (codeOverride?: string) => {
      const query = codeOverride ?? lookupValue;
      const matches = findInventoryLookupMatches(items, query);

      if (!query.trim()) {
        setLookupError("Type an item name, SKU, or scan an inventory QR code.");
        return;
      }

      if (matches.length === 0) {
        setLookupError("No inventory item matched that name, SKU, or QR code.");
        return;
      }

      if (matches.length > 1) {
        setLookupError(
          "Multiple inventory items match that search. Use a more specific name, SKU, or QR code.",
        );
        return;
      }

      addItemToCart(matches[0]);
    },
    [addItemToCart, items, lookupValue],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraState((current) => (current === "unsupported" ? current : "idle"));
    setCameraMessage("");
  }, []);

  useEffect(
    () => () => {
      stopCamera();
    },
    [stopCamera],
  );

  useEffect(() => {
    if (cameraState !== "active" || !videoRef.current || !canvasRef.current) {
      return;
    }

    let cancelled = false;

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !canvasRef.current) {
        return;
      }

      try {
        const rawValue = readQrFromVideoFrame(
          videoRef.current,
          canvasRef.current,
        );
        const code = extractInventoryItemQrCode(rawValue);
        if (code) {
          setLookupValue(rawValue);
          handleAddByCode(code);
          stopCamera();
          return;
        }
      } catch {
        setCameraMessage(
          "Camera is active. Align the inventory QR inside the frame.",
        );
      }

      window.setTimeout(scanFrame, 450);
    };

    void scanFrame();

    return () => {
      cancelled = true;
    };
  }, [cameraState, handleAddByCode, stopCamera]);

  useEffect(() => {
    if (cameraState !== "requesting" && cameraState !== "active") {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraMessage(
        "Camera is ready. Tap Start camera again if preview does not appear.",
      );
    });
  }, [cameraState]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error("You must be signed in to process a POS sale.");
      }

      if (cart.length === 0) {
        throw new Error("Add at least one item to the cart before checkout.");
      }

      if (
        (paymentMethod === "gcash" || paymentMethod === "card") &&
        !paymentReference.trim()
      ) {
        throw new Error(
          "Reference details are required for GCash and card payments.",
        );
      }

      // Create inventory logs for ALL items in the cart
      try {
        for (const entry of cart) {
          const payload = {
            patientId: patientId || null,
            appointmentId: null,
            itemId: entry.item.id,
            quantity: entry.quantity,
            notes: paymentNotes.trim() || "",
            scannedCode: entry.item.qrCode,
            recordedBy: profile.id,
          };
          const inventoryLogs = await createInventoryLogs(payload);
          console.log("Inventory log created:", inventoryLogs);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        throw new Error(
          `Failed to create inventory logs: ${message}`,
        );
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
      const checkoutPatient = selectedPatient;
      const checkoutPatientId = result.sale?.patientId ?? null;
      let doctorAssignedName = "N/A";
      if (checkoutPatientId) {
        try {
          const patientConsultations =
            await listConsultationsByPatientIdLiveOrDemo(checkoutPatientId);
          const latestConsultation = patientConsultations
            .slice()
            .sort((left, right) =>
              right.createdAt.localeCompare(left.createdAt),
            )[0];

          if (latestConsultation?.doctorId) {
            const doctorMatch = doctors.find(
              (doctor) => doctor.id === latestConsultation.doctorId,
            );
            doctorAssignedName =
              formatDoctorSignatureName(
                doctorMatch?.fullName ?? latestConsultation.providerName,
                doctorMatch?.title ?? null,
              ) || "N/A";
          } else if (latestConsultation?.providerName) {
            doctorAssignedName = formatDoctorSignatureName(
              latestConsultation.providerName,
            );
          }
        } catch {
          doctorAssignedName = "N/A";
        }
      }

      const receptionistName =
        users.find((user) => user.id === result.sale?.cashierId)?.fullName ??
        profile?.fullName ??
        "N/A";

      setCart([]);
      setLookupValue("");
      setLookupError("");
      setPaymentReference("");
      setPaymentNotes("");
      setPatientId("");
      setLastReceiptId(result.sale?.id ?? null);
      setReceiptState(
        result.sale
          ? {
              saleNumber: result.sale.saleNumber,
              customerName: checkoutPatient
                ? `${checkoutPatient.firstName} ${checkoutPatient.lastName}`
                : "Walk-in customer",
              doctorAssignedName,
              receptionistName,
              paymentMethod: result.sale.paymentMethod,
              paymentReference: result.sale.paymentReference ?? null,
              issuedAt: result.sale.createdAt,
              subtotal: result.sale.subtotal,
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryUsageLogs,
      });
      toast.success("POS sale completed and stock updated.");
    },
  });

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
          toast.error(
            `Only ${entry.item.stockOnHand} ${entry.item.unit} available for ${entry.item.name}.`,
          );
          return [entry];
        }

        return [{ ...entry, quantity: nextQuantity }];
      }),
    );
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      setCameraMessage(
        "This device or browser does not support camera access.",
      );
      return;
    }

    stopCamera();
    setCameraState("requesting");
    setCameraMessage("Requesting camera permission...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState("active");
      setCameraMessage("Camera ready. Point it at the item QR code.");
    } catch {
      setCameraState("denied");
      setCameraMessage(
        "Camera permission was denied. You can still type the SKU or QR value manually.",
      );
    }
  }

  function handleLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAddByCode();
  }

  function selectCustomer(nextPatientId: string) {
    if (!nextPatientId) {
      setPatientId("");
      setCustomerSearch("");
      setIsCustomerDropdownOpen(false);
      return;
    }

    const matchedPatient =
      patients.find((patient) => patient.id === nextPatientId) ?? null;
    setPatientId(nextPatientId);
    setCustomerSearch(
      matchedPatient
        ? `${matchedPatient.firstName} ${matchedPatient.lastName}`
        : "",
    );
    setIsCustomerDropdownOpen(false);
  }

  const selectedPatient =
    patients.find((patient) => patient.id === patientId) ?? null;
  const paymentReferenceRequired =
    paymentMethod === "gcash" || paymentMethod === "card";
  const cameraStatusLabel = useMemo(() => {
    if (cameraState === "active") {
      return "Camera active";
    }
    if (cameraState === "requesting") {
      return "Waiting for permission";
    }
    if (cameraState === "denied") {
      return "Permission denied";
    }
    if (cameraState === "unsupported") {
      return "Camera unsupported";
    }
    return "Camera idle";
  }, [cameraState]);

  async function handlePrintReceipt() {
    if (!receiptState) {
      return;
    }

    await printHtmlDocument(buildPosReceiptPrintDocument(receiptState));
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="shrink-0 bg-orange-600 p-2.5 text-white">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Point of Sale
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                Inventory-based Checkout
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Scan or search items, review the cart, and complete checkout in
                one place.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
            <CircleDashed className="size-4 text-orange-600" />
            <span>{cameraStatusLabel}</span>
          </div>
        </div>
      </div>

      {/* Last sale success banner */}
      {recentSale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <ShoppingCart className="size-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                Sale completed — {recentSale.saleNumber}
              </p>
              <p className="text-xs text-emerald-700">
                {formatCurrency(recentSale.total)} via{" "}
                {recentSale.paymentMethod.toUpperCase()}
              </p>
            </div>
          </div>
          {receiptState ? (
            <Button
              className="gap-2 text-xs"
              onClick={() => void handlePrintReceipt()}
              type="button"
              variant="secondary"
            >
              <Printer className="size-3.5" />
              Print receipt
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Main 2-column grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        {/* Left column: Item lookup + Cart */}
        <div className="space-y-5">
          {/* Item lookup */}
          <Card>
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Add Items
            </p>
            <form onSubmit={handleLookupSubmit}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <QrCode className="size-4 shrink-0 text-slate-400" />
                  <Input
                    className="border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                    onChange={(event) => setLookupValue(event.target.value)}
                    placeholder="Item name, SKU, or QR value"
                    value={lookupValue}
                  />
                </div>
                <Button className="shrink-0 gap-1.5" type="submit">
                  <Search className="size-3.5" />
                  Add
                </Button>
                <Button
                  className="shrink-0 gap-1.5"
                  onClick={() => void startCamera()}
                  type="button"
                  variant="secondary"
                >
                  <Camera className="size-3.5" />
                  {cameraState === "active" ? "Restart" : "Scan QR"}
                </Button>
                {cameraState === "active" ? (
                  <Button
                    className="shrink-0 gap-1.5"
                    onClick={stopCamera}
                    type="button"
                    variant="secondary"
                  >
                    <StopCircle className="size-3.5" />
                    Stop
                  </Button>
                ) : null}
              </div>
            </form>

            {cameraMessage ? (
              <p className="mt-2 text-xs text-slate-500">{cameraMessage}</p>
            ) : null}

            {cameraState === "requesting" || cameraState === "active" ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black">
                <video
                  className="aspect-video w-full object-cover opacity-90"
                  muted
                  playsInline
                  ref={videoRef}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-36 w-36 rounded-xl border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                </div>
                <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-slate-100">
                  Keep item QR inside the frame
                </p>
                <canvas className="hidden" ref={canvasRef} />
              </div>
            ) : null}

            {hasLookupMatches ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {lookupMatches.length === 1
                    ? "Matching item"
                    : `${lookupMatches.length} matches — select one`}
                </p>
                <div className="grid gap-1 p-2 sm:grid-cols-2">
                  {lookupMatches.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      className="rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                      onClick={() => openQuantityModal(item)}
                      type="button"
                    >
                      <p className="text-sm font-semibold text-slate-950">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        SKU {item.sku} · {formatCurrency(item.sellingPrice)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {lookupError ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{lookupError}</p>
              </div>
            ) : null}
          </Card>

          {/* Cart */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-slate-400" />
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                  Cart
                </p>
                {cart.length > 0 ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                    {cart.length} line{cart.length !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
              {cart.length > 0 ? (
                <button
                  className="text-xs font-semibold text-slate-400 transition hover:text-rose-600"
                  onClick={() => setCart([])}
                  type="button"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            {cart.length === 0 ? (
              <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                <ShoppingCart className="mx-auto size-7 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  No items added yet
                </p>
                <p className="text-xs text-slate-400">
                  Search or scan an item above
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Item
                      </th>
                      <th className="pb-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Stock
                      </th>
                      <th className="pb-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Qty
                      </th>
                      <th className="pb-2 text-right text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Price
                      </th>
                      <th className="pb-2 text-right text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Total
                      </th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cart.map((entry) => (
                      <tr key={entry.item.id}>
                        <td className="py-3 pr-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {entry.item.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {entry.item.sku} · {entry.item.unit}
                          </p>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              entry.item.stockOnHand <= entry.item.reorderLevel
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {entry.item.stockOnHand}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <Input
                            className="mx-auto w-16 text-center text-sm"
                            min="1"
                            max={entry.item.stockOnHand}
                            type="number"
                            value={entry.quantity}
                            onChange={(event) =>
                              updateCartQuantity(
                                entry.item.id,
                                Number(event.target.value),
                              )
                            }
                          />
                        </td>
                        <td className="py-3 text-right text-sm text-slate-500">
                          {formatCurrency(entry.item.sellingPrice)}
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(
                            entry.item.sellingPrice * entry.quantity,
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <button
                            aria-label={`Remove ${entry.item.name}`}
                            className="text-slate-300 transition hover:text-rose-500"
                            onClick={() =>
                              setCart((currentCart) =>
                                currentCart.filter(
                                  (cartEntry) =>
                                    cartEntry.item.id !== entry.item.id,
                                ),
                              )
                            }
                            type="button"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td
                        className="pt-3 text-right text-xs font-extrabold uppercase tracking-widest text-slate-400"
                        colSpan={4}
                      >
                        Subtotal
                      </td>
                      <td className="pt-3 text-right text-base font-extrabold text-slate-950">
                        {formatCurrency(cartSubtotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Checkout — sticky on large screens */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Checkout
            </p>

            <div className="space-y-4">
              {/* Customer */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <UserRound className="size-4 shrink-0 text-slate-400" />
                    <Input
                      className="border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                      onBlur={() => {
                        window.setTimeout(
                          () => setIsCustomerDropdownOpen(false),
                          120,
                        );
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onChange={(event) => {
                        const query = event.target.value;
                        setCustomerSearch(query);
                        setIsCustomerDropdownOpen(true);

                        const exactMatch = patients.find(
                          (patient) =>
                            `${patient.firstName} ${patient.lastName}`
                              .trim()
                              .toLowerCase() ===
                            query.trim().toLowerCase(),
                        );
                        setPatientId(exactMatch?.id ?? "");
                      }}
                      placeholder="Search customer name or select walk-in"
                      value={customerSearch}
                    />
                  </div>

                  {isCustomerDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
                      <button
                        className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                          !patientId
                            ? "bg-orange-50 text-orange-800"
                            : "text-slate-700"
                        }`}
                        onMouseDown={() => selectCustomer("")}
                        type="button"
                      >
                        Walk-in customer
                      </button>
                      {filteredPatients.length > 0 ? (
                        filteredPatients.slice(0, 20).map((patient) => (
                          <button
                            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                              patientId === patient.id
                                ? "bg-orange-50 text-orange-800"
                                : "text-slate-700"
                            }`}
                            key={patient.id}
                            onMouseDown={() => selectCustomer(patient.id)}
                            type="button"
                          >
                            {patient.firstName} {patient.lastName}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          No matching customers found.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentOptions.map((option) => {
                    const isActive = paymentMethod === option.value;
                    const Icon =
                      option.value === "cash"
                        ? ShoppingCart
                        : option.value === "gcash"
                          ? Smartphone
                          : CreditCard;
                    return (
                      <button
                        key={option.value}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                        onClick={() => setPaymentMethod(option.value)}
                        type="button"
                      >
                        <Icon className="size-4" />
                        <p className="mt-1.5 text-xs font-bold">
                          {option.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reference / notes */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {paymentMethod === "cash"
                    ? "Cash notes"
                    : "Payment reference"}
                  {paymentReferenceRequired ? (
                    <span className="ml-1 text-rose-500">*</span>
                  ) : null}
                </label>
                <Input
                  placeholder={
                    paymentMethod === "cash"
                      ? "Optional cashier note"
                      : "Required — reference number or details"
                  }
                  value={
                    paymentMethod === "cash" ? paymentNotes : paymentReference
                  }
                  onChange={(event) => {
                    if (paymentMethod === "cash") {
                      setPaymentNotes(event.target.value);
                      return;
                    }
                    setPaymentReference(event.target.value);
                  }}
                />
                {paymentReferenceRequired ? (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Required for {paymentMethod.toUpperCase()} payments.
                  </p>
                ) : null}
              </div>

              {paymentMethod !== "cash" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Additional notes
                  </label>
                  <Input
                    placeholder="Optional note"
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                  />
                </div>
              ) : null}

              {/* Order summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Items</span>
                  <span className="font-semibold text-slate-900">
                    {cartCount}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Payment</span>
                  <span className="font-semibold uppercase text-slate-900">
                    {paymentMethod}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold text-slate-700">
                    Total
                  </span>
                  <span className="text-xl font-extrabold text-slate-950">
                    {formatCurrency(cartSubtotal)}
                  </span>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                disabled={checkoutMutation.isPending || cart.length === 0}
                onClick={() => checkoutMutation.mutate()}
                type="button"
              >
                <ShoppingCart className="size-4" />
                {checkoutMutation.isPending
                  ? "Processing..."
                  : `Complete sale (${formatCurrency(cartSubtotal)})`}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {pendingItem ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onClick={closeQuantityModal}
          role="dialog"
        >
          <div
            className="w-full max-w-md border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 bg-orange-600 px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-100">
                  Add to cart
                </p>
                <p className="mt-1 text-sm font-bold">{pendingItem.name}</p>
                <p className="text-xs text-orange-100">
                  {formatCurrency(pendingItem.sellingPrice)} each · {pendingItem.stockOnHand} {pendingItem.unit} available
                </p>
              </div>
              <button
                aria-label="Close quantity modal"
                className="border border-orange-200/40 bg-white/10 p-1.5 text-white transition hover:bg-white/20"
                onClick={closeQuantityModal}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                Quantity
              </label>
              <Input
                autoFocus
                max={pendingItem.stockOnHand}
                min="1"
                onChange={(event) => setPendingQuantity(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmAddQuantity();
                  }
                }}
                type="number"
                value={pendingQuantity}
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Line total preview: {formatCurrency((Number(pendingQuantity) || 0) * pendingItem.sellingPrice)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <Button onClick={closeQuantityModal} type="button" variant="secondary">
                Cancel
              </Button>
              <Button onClick={confirmAddQuantity} type="button">
                Add item
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
