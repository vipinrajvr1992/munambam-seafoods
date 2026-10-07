import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const STORE_NAME = "Munambam Seafoods";
const CURRENCY = "INR";

const REMOTE_STATES = new Set([
  "Jammu and Kashmir",
  "Ladakh",
  "Arunachal Pradesh",
  "Assam",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Tripura",
  "Andaman and Nicobar Islands",
  "Lakshadweep",
]);

const DELIVERY_RULES = {
  samePin: {
    base: 49,
    step: 25,
  },
  sameDistrict: {
    base: 59,
    step: 30,
  },
  sameState: {
    base: 75,
    step: 35,
  },
  otherState: {
    base: 99,
    step: 45,
  },
  remote: {
    base: 149,
    step: 55,
  },
};

type JsonObject = Record<string, unknown>;

type CartItem = {
  product_id?: string | null;
  product_slug?: string | null;
  pack?: string | null;
  weight_grams?: number | null;
  quantity?: number | null;
};

type CustomerInput = {
  full_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
};

type ResolvedItem = {
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  weight_grams: number;
  unit_price: number;
  quantity: number;
  gst_rate: number;
  hsn_code: string | null;
  taxable_amount: number;
  line_total: number;
};

function json(
  data: JsonObject,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders,
    },
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function paise(value: number): number {
  return Math.round(round2(value) * 100);
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown): string {
  let digits = safeString(value).replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  digits = digits.slice(0, 10);

  return digits.length === 10 ? `+91${digits}` : digits;
}

function validIndianPhone(value: unknown): boolean {
  return /^\+91[6-9]\d{9}$/.test(normalizePhone(value));
}

function validEmail(value: unknown): boolean {
  const email = safeString(value);

  if (!email) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPincode(value: unknown): boolean {
  return /^\d{6}$/.test(safeString(value));
}

function validUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(safeString(value));
}

function parseWeightFromPack(pack: unknown): number {
  const value = safeString(pack).toLowerCase();

  if (value.includes("500")) return 500;
  if (value.includes("250")) return 250;
  if (value.includes("100")) return 100;

  return 0;
}

function chargeableWeightGrams(
  items: ResolvedItem[],
): number {
  const net = items.reduce(
    (sum, item) =>
      sum + item.weight_grams * item.quantity,
    0,
  );

  const packaging = Math.max(
    100,
    Math.ceil(net / 1000) * 100,
  );

  return Math.max(
    500,
    Math.ceil((net + packaging) / 500) * 500,
  );
}

function deliveryFee(
  items: ResolvedItem[],
  customer: CustomerInput,
  deliveryEnabled: boolean,
  freeThreshold: number,
): number {
  if (!deliveryEnabled) {
    return 0;
  }

  const state = safeString(customer.state);
  const district = safeString(customer.district);
  const pin = safeString(customer.pincode);

  let rule = DELIVERY_RULES.otherState;

  if (pin === "683515") {
    rule = DELIVERY_RULES.samePin;
  } else if (REMOTE_STATES.has(state)) {
    rule = DELIVERY_RULES.remote;
  } else if (
    state.toLowerCase() === "kerala" &&
    district.toLowerCase() === "ernakulam"
  ) {
    rule = DELIVERY_RULES.sameDistrict;
  } else if (state.toLowerCase() === "kerala") {
    rule = DELIVERY_RULES.sameState;
  }

  const weight = chargeableWeightGrams(items);
  const slabs = Math.max(1, Math.ceil(weight / 500));

  const subtotal = items.reduce(
    (sum, item) => sum + item.line_total,
    0,
  );

  if (
    freeThreshold > 0 &&
    subtotal >= freeThreshold
  ) {
    return 0;
  }

  return round2(
    rule.base + (slabs - 1) * rule.step,
  );
}

function calculateDiscount(
  code: string | null,
  subtotal: number,
): number {
  if (!code) return 0;

  const normalized = code.trim().toUpperCase();

  if (normalized === "SAVE25") {
    if (subtotal >= 500) {
      return 25;
    }

    return 0;
  }

  if (normalized === "SAVE50") {
    if (subtotal >= 1000) {
      return 50;
    }

    return 0;
  }

  return 0;
}

function calculateGst(
  items: ResolvedItem[],
  discount: number,
  globalTaxRate: number | null,
): {
  taxableAmount: number;
  gstAmount: number;
} {
  const subtotal = items.reduce(
    (sum, item) => sum + item.line_total,
    0,
  );

  if (subtotal <= 0) {
    return {
      taxableAmount: 0,
      gstAmount: 0,
    };
  }

  const ratio = Math.max(
    0,
    (subtotal - discount) / subtotal,
  );

  let taxableAmount = 0;
  let gstAmount = 0;

  for (const item of items) {
    const taxableLine = round2(
      item.line_total * ratio,
    );

    const rate =
      globalTaxRate !== null && globalTaxRate > 0
        ? globalTaxRate
        : item.gst_rate;

    taxableAmount += taxableLine;
    gstAmount +=
      taxableLine * Math.max(0, rate) / 100;
  }

  return {
    taxableAmount: round2(taxableAmount),
    gstAmount: round2(gstAmount),
  };
}

function orderNumber(): string {
  const now = new Date();

  const date =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(now.getUTCDate()).padStart(2, "0")}`;

  const random = crypto.randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `MNS-${date}-${random}`;
}

async function hmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return Array.from(
    new Uint8Array(signature),
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function safeJson(value: unknown): JsonObject {
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return value as JsonObject;
  }

  return {};
}

async function razorpayRequest(
  url: string,
  keyId: string,
  keySecret: string,
  options: RequestInit = {},
): Promise<JsonObject> {
  const auth = btoa(
    `${keyId}:${keySecret}`,
  );

  const headers = new Headers(
    options.headers || {},
  );

  headers.set(
    "Authorization",
    `Basic ${auth}`,
  );

  headers.set(
    "Content-Type",
    "application/json",
  );

  const response = await fetch(
    url,
    {
      ...options,
      headers,
    },
  );

  const body = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const message =
      safeJson(body).error &&
      typeof safeJson(body).error === "object"
        ? safeJson(
            safeJson(body).error,
          ).description
        : null;

    throw new Error(
      safeString(message) ||
      `Razorpay request failed (${response.status}).`,
    );
  }

  return safeJson(body);
}

async function logActivity(
  adminClient: ReturnType<typeof createClient>,
  action: string,
  orderId: string | null,
  description: string,
  metadata: JsonObject = {},
): Promise<void> {
  try {
    await adminClient
      .from("admin_activity_logs")
      .insert({
        user_id: null,
        role_code: "customer",
        action,
        module: "orders",
        target_type: "order",
        target_id: orderId,
        description,
        metadata,
        result: "success",
      });
  } catch {
    // Activity logging must never break a successful purchase.
  }
}

async function getSettings(
  adminClient: ReturnType<typeof createClient>,
): Promise<{
  taxRate: number | null;
  deliveryEnabled: boolean;
  freeDeliveryThreshold: number;
}> {
  const { data } = await adminClient
    .from("settings")
    .select(
      "tax_rate,delivery_enabled,free_delivery_threshold",
    )
    .limit(1)
    .maybeSingle();

  const taxValue = Number(data?.tax_rate);

  return {
    // A stored value of 0 means "no global override".
    // In that case, calculateGst() must use each variant's own gst_rate.
    taxRate:
      Number.isFinite(taxValue) &&
      taxValue > 0
        ? taxValue
        : null,

    deliveryEnabled:
      typeof data?.delivery_enabled === "boolean"
        ? data.delivery_enabled
        : true,

    freeDeliveryThreshold:
      Number.isFinite(
        Number(data?.free_delivery_threshold),
      )
        ? Math.max(
            0,
            Number(data?.free_delivery_threshold),
          )
        : 0,
  };
}

async function resolveCart(
  adminClient: ReturnType<typeof createClient>,
  cart: CartItem[],
): Promise<ResolvedItem[]> {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Your cart is empty.");
  }

  if (cart.length > 50) {
    throw new Error("Too many items in cart.");
  }

  const result: ResolvedItem[] = [];

  for (const raw of cart) {
    const quantity = Math.max(
      1,
      Math.floor(Number(raw.quantity) || 0),
    );

    if (quantity > 100) {
      throw new Error(
        "Maximum quantity per item is 100.",
      );
    }

    let productId = safeString(
      raw.product_id,
    );

    const productSlug = safeString(
      raw.product_slug,
    );

    if (!validUuid(productId)) {
      productId = "";
    }

    if (!productId && productSlug) {
      const { data: product, error } =
        await adminClient
          .from("products")
          .select("id")
          .eq("slug", productSlug)
          .eq("is_active", true)
          .maybeSingle();

      if (error || !product) {
        throw new Error(
          "One of the products is no longer available.",
        );
      }

      productId = product.id;
    }

    if (!validUuid(productId)) {
      throw new Error(
        "Invalid product in cart.",
      );
    }

    let weight =
      Number(raw.weight_grams) || 0;

    if (![100, 250, 500].includes(weight)) {
      weight = parseWeightFromPack(
        raw.pack,
      );
    }

    if (![100, 250, 500].includes(weight)) {
      throw new Error(
        "Invalid product pack size.",
      );
    }

    const { data: variant, error } =
      await adminClient
        .from("product_variants")
        .select(
          "id,product_id,weight_grams,variant_name,price,gst_rate,stock_quantity,is_active,hsn_code",
        )
        .eq("product_id", productId)
        .eq("weight_grams", weight)
        .eq("is_active", true)
        .maybeSingle();

    if (
      error ||
      !variant
    ) {
      throw new Error(
        "One of the selected pack sizes is unavailable.",
      );
    }

    const price = Number(
      variant.price,
    );

    const stock = Number(
      variant.stock_quantity,
    );

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Invalid product price.",
      );
    }

    if (
      !Number.isFinite(stock) ||
      stock < quantity
    ) {
      throw new Error(
        `${variant.variant_name || "This product"} is out of stock or has insufficient stock.`,
      );
    }

    const lineTotal = round2(
      price * quantity,
    );

    const gstRate =
      Number.isFinite(
        Number(variant.gst_rate),
      )
        ? Number(variant.gst_rate)
        : 0;

    result.push({
      product_id: variant.product_id,
      variant_id: variant.id,
      product_name: "",
      variant_name:
        safeString(
          variant.variant_name,
        ) || `${weight}g`,
      weight_grams: weight,
      unit_price: price,
      quantity,
      gst_rate: gstRate,
      hsn_code:
        safeString(variant.hsn_code) ||
        null,
      taxable_amount: lineTotal,
      line_total: lineTotal,
    });
  }

  // Merge duplicate variants so stock is reserved only once.
  const merged = new Map<
    string,
    ResolvedItem
  >();

  for (const item of result) {
    const key = item.variant_id;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      existing.line_total = round2(
        existing.unit_price *
          existing.quantity,
      );
    } else {
      merged.set(
        key,
        { ...item },
      );
    }
  }

  const mergedItems =
    Array.from(merged.values());

  for (const item of mergedItems) {
    const { data: product } =
      await adminClient
        .from("products")
        .select("name")
        .eq("id", item.product_id)
        .maybeSingle();

    if (!product) {
      throw new Error(
        "Product information could not be loaded.",
      );
    }

    item.product_name =
      safeString(product.name) ||
      "Munambam Product";

    item.taxable_amount =
      item.line_total;
  }

  return mergedItems;
}

async function findOrCreateCustomer(
  adminClient: ReturnType<typeof createClient>,
  customer: CustomerInput,
): Promise<string> {
  const phone =
    normalizePhone(customer.phone);

  const email =
    safeString(customer.email) ||
    null;

  const payload = {
    full_name:
      safeString(customer.full_name),
    mobile_number: phone,
    email,
    address:
      safeString(customer.address),
    city:
      safeString(customer.city),
    state:
      safeString(customer.state) || "Kerala",
    pincode:
      safeString(customer.pincode),
    landmark:
      safeString(customer.landmark) ||
      null,
  };

  const { data: existing } =
    await adminClient
      .from("customers")
      .select("id")
      .eq("mobile_number", phone)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (existing?.id) {
    const { error } =
      await adminClient
        .from("customers")
        .update({
          ...payload,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", existing.id);

    if (error) {
      throw new Error(
        "Unable to update customer details.",
      );
    }

    return existing.id;
  }

  const { data: created, error } =
    await adminClient
      .from("customers")
      .insert(payload)
      .select("id")
      .single();

  if (error || !created?.id) {
    throw new Error(
      "Unable to save customer details.",
    );
  }

  return created.id;
}

async function reserveInventory(
  adminClient: ReturnType<typeof createClient>,
  orderId: string,
  items: ResolvedItem[],
): Promise<void> {
  for (const item of items) {
    const { error } =
      await adminClient.rpc(
        "reserve_inventory",
        {
          p_order_id: orderId,
          p_variant_id: item.variant_id,
          p_quantity: item.quantity,
        },
      );

    if (error) {
      throw new Error(
        `Unable to reserve stock for ${item.product_name}.`,
      );
    }
  }
}

async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  amount: number,
  orderNumberValue: string,
): Promise<JsonObject> {
  return await razorpayRequest(
    "https://api.razorpay.com/v1/orders",
    keyId,
    keySecret,
    {
      method: "POST",
      body: JSON.stringify({
        amount: paise(amount),
        currency: CURRENCY,
        receipt: orderNumberValue,
        notes: {
          store: STORE_NAME,
          order_number: orderNumberValue,
        },
      }),
    },
  );
}

async function consumeInventory(
  adminClient: ReturnType<typeof createClient>,
  orderId: string,
): Promise<void> {
  const { data: reservations } =
    await adminClient
      .from("inventory_reservations")
      .select(
        "id,variant_id,quantity,state",
      )
      .eq("order_id", orderId)
      .eq("state", "reserved");

  if (!reservations?.length) {
    return;
  }

  for (const reservation of reservations) {
    const quantity =
      Number(reservation.quantity);

    const { data: inventory } =
      await adminClient
        .from("inventory")
        .select(
          "id,variant_id,stock,reserved_stock",
        )
        .eq(
          "variant_id",
          reservation.variant_id,
        )
        .maybeSingle();

    if (inventory) {
      const stockBefore =
        Number(inventory.stock);

      const reservedBefore =
        Number(
          inventory.reserved_stock,
        );

      const newStock =
        Math.max(
          0,
          stockBefore - quantity,
        );

      const newReserved =
        Math.max(
          0,
          reservedBefore - quantity,
        );

      await adminClient
        .from("inventory")
        .update({
          stock: newStock,
          reserved_stock: newReserved,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", inventory.id);

      await adminClient
        .from("inventory_logs")
        .insert({
          variant_id:
            reservation.variant_id,
          change_type:
            "reservation_consume",
          quantity_change:
            -quantity,
          stock_before:
            stockBefore,
          stock_after:
            newStock,
          order_id: orderId,
          reference_id:
            reservation.id,
          note:
            "Razorpay payment confirmed.",
        });
    }

    const { data: variant } =
      await adminClient
        .from("product_variants")
        .select(
          "id,stock_quantity",
        )
        .eq(
          "id",
          reservation.variant_id,
        )
        .maybeSingle();

    if (variant) {
      const current =
        Number(
          variant.stock_quantity,
        );

      await adminClient
        .from("product_variants")
        .update({
          stock_quantity:
            Math.max(
              0,
              current - quantity,
            ),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reservation.variant_id,
        );
    }

    await adminClient
      .from("inventory_reservations")
      .update({
        state: "consumed",
        consumed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        reservation.id,
      )
      .eq(
        "state",
        "reserved",
      );
  }
}

async function handleCreateOrder(
  adminClient: ReturnType<typeof createClient>,
  body: JsonObject,
  keyId: string,
  keySecret: string,
): Promise<Response> {
  const customer =
    safeJson(body.customer) as CustomerInput;

  const cart =
    Array.isArray(body.cart)
      ? body.cart as CartItem[]
      : [];

  const suppliedKey =
    safeString(
      body.idempotency_key,
    );

  const idempotencyKey =
    validUuid(suppliedKey)
      ? suppliedKey
      : crypto.randomUUID();

  if (
    !safeString(customer.full_name) ||
    !safeString(customer.address) ||
    !safeString(customer.city) ||
    !safeString(customer.state)
  ) {
    return json(
      {
        ok: false,
        error:
          "Please complete all required delivery details.",
      },
      400,
    );
  }

  if (
    !validIndianPhone(customer.phone)
  ) {
    return json(
      {
        ok: false,
        error:
          "Please enter a valid 10-digit mobile number.",
      },
      400,
    );
  }

  if (
    !validEmail(customer.email)
  ) {
    return json(
      {
        ok: false,
        error:
          "Please enter a valid email address.",
      },
      400,
    );
  }

  if (
    !validPincode(customer.pincode)
  ) {
    return json(
      {
        ok: false,
        error:
          "Please enter a valid 6-digit PIN code.",
      },
      400,
    );
  }

  // Prevent duplicate create_order requests.
  const { data: existingOrder } =
    await adminClient
      .from("orders")
      .select(
        "id,order_number,total_amount,currency,razorpay_order_id,payment_status,order_status",
      )
      .eq(
        "idempotency_key",
        idempotencyKey,
      )
      .maybeSingle();

  if (existingOrder) {
    if (
      existingOrder.razorpay_order_id
    ) {
      return json({
        ok: true,
        internal_order_id:
          existingOrder.id,
        order_number:
          existingOrder.order_number,
        razorpay_order_id:
          existingOrder.razorpay_order_id,
        amount: paise(
          Number(
            existingOrder.total_amount,
          ),
        ),
        currency:
          existingOrder.currency ||
          CURRENCY,
        key_id: keyId,
        description:
          `${STORE_NAME} Order`,
      });
    }
  }

  const settings =
    await getSettings(
      adminClient,
    );

  const items =
    await resolveCart(
      adminClient,
      cart,
    );

  const subtotal = round2(
    items.reduce(
      (sum, item) =>
        sum + item.line_total,
      0,
    ),
  );

  const couponCode =
    safeString(
      body.coupon_code,
    ) || null;

  const discount = round2(
    Math.min(
      subtotal,
      calculateDiscount(
        couponCode,
        subtotal,
      ),
    ),
  );

  const gst =
    calculateGst(
      items,
      discount,
      settings.taxRate,
    );

  const delivery =
    deliveryFee(
      items,
      customer,
      settings.deliveryEnabled,
      settings.freeDeliveryThreshold,
    );

  // Final payable amount is always:
  // (subtotal - discount) + GST + delivery.
  // GST falls back to each product variant's gst_rate when no
  // positive global tax override is configured.
  const total = round2(
    Math.max(
      0,
      subtotal - discount,
    ) +
      gst.gstAmount +
      delivery,
  );

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return json(
      {
        ok: false,
        error:
          "Unable to calculate a valid order total.",
      },
      400,
    );
  }

  const customerId =
    await findOrCreateCustomer(
      adminClient,
      customer,
    );

  const newOrderNumber =
    orderNumber();

  const shippingSnapshot = {
    full_name:
      safeString(customer.full_name),
    phone:
      normalizePhone(customer.phone),
    email:
      safeString(customer.email),
    address:
      safeString(customer.address),
    city:
      safeString(customer.city),
    district:
      safeString(customer.district),
    state:
      safeString(customer.state),
    pincode:
      safeString(customer.pincode),
    landmark:
      safeString(customer.landmark),
  };

  const { data: createdOrder, error: orderError } =
    await adminClient
      .from("orders")
      .insert({
        order_number:
          newOrderNumber,
        customer_id:
          customerId,
        subtotal,
        gst_amount:
          gst.gstAmount,
        delivery_fee:
          delivery,
        total_amount:
          total,
        currency:
          CURRENCY,
        order_status:
          "pending",
        payment_status:
          "pending",
        customer_name_snapshot:
          safeString(customer.full_name),
        customer_email_snapshot:
          safeString(customer.email),
        customer_phone_snapshot:
          normalizePhone(customer.phone),
        shipping_address_snapshot:
          shippingSnapshot,
        discount_amount:
          discount,
        idempotency_key:
          idempotencyKey,
      })
      .select("id,order_number")
      .single();

  if (
    orderError ||
    !createdOrder?.id
  ) {
    throw new Error(
      "Unable to create your order.",
    );
  }

  const orderId =
    createdOrder.id;

  try {
    const orderItems = items.map(
      (item) => {
        const ratio =
          subtotal > 0
            ? Math.max(
                0,
                (subtotal - discount) /
                  subtotal,
              )
            : 1;

        const taxable =
          round2(
            item.line_total *
              ratio,
          );

        return {
          order_id:
            orderId,
          product_id:
            item.product_id,
          variant_id:
            item.variant_id,
          product_name:
            item.product_name,
          variant_name:
            item.variant_name,
          unit_price:
            item.unit_price,
          quantity:
            item.quantity,
          gst_rate:
            item.gst_rate,
          line_total:
            item.line_total,
          pack_size_snapshot:
            `${item.weight_grams}g`,
          hsn_code:
            item.hsn_code,
          taxable_amount:
            taxable,
          discount_amount:
            round2(
              item.line_total -
                taxable,
            ),
        };
      },
    );

    const { error: itemsError } =
      await adminClient
        .from("order_items")
        .insert(orderItems);

    if (itemsError) {
      throw new Error(
        "Unable to save order items.",
      );
    }

    // Reserve stock BEFORE exposing the Razorpay payment window.
    await reserveInventory(
      adminClient,
      orderId,
      items,
    );

    const razorpayOrder =
      await createRazorpayOrder(
        keyId,
        keySecret,
        total,
        newOrderNumber,
      );

    const razorpayOrderId =
      safeString(
        razorpayOrder.id,
      );

    if (!razorpayOrderId) {
      throw new Error(
        "Razorpay did not return a valid order ID.",
      );
    }

    const razorpayAmount =
      Number(
        razorpayOrder.amount,
      );

    if (
      razorpayAmount !==
      paise(total)
    ) {
      throw new Error(
        "Razorpay amount verification failed.",
      );
    }

    const { error: updateOrderError } =
      await adminClient
        .from("orders")
        .update({
          razorpay_order_id:
            razorpayOrderId,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          orderId,
        );

    if (updateOrderError) {
      throw new Error(
        "Unable to link Razorpay order.",
      );
    }

    const { error: paymentError } =
      await adminClient
        .from("payments")
        .insert({
          order_id:
            orderId,
          provider:
            "razorpay",
          razorpay_order_id:
            razorpayOrderId,
          amount:
            total,
          currency:
            CURRENCY,
          status:
            "created",
          raw_response:
            razorpayOrder,
        });

    if (paymentError) {
      throw new Error(
        "Unable to create payment record.",
      );
    }

    await logActivity(
      adminClient,
      "order_created",
      orderId,
      `Customer order ${newOrderNumber} created.`,
      {
        order_number:
          newOrderNumber,
        razorpay_order_id:
          razorpayOrderId,
        amount:
          total,
        currency:
          CURRENCY,
        item_count:
          items.reduce(
            (sum, item) =>
              sum + item.quantity,
            0,
          ),
        payment_status:
          "pending",
      },
    );

    return json({
      ok: true,
      internal_order_id:
        orderId,
      order_number:
        newOrderNumber,
      razorpay_order_id:
        razorpayOrderId,
      amount:
        paise(total),
      currency:
        CURRENCY,
      key_id:
        keyId,
      description:
        `${STORE_NAME} Order ${newOrderNumber}`,
    });
  } catch (error) {
    await adminClient
      .from("orders")
      .update({
        order_status:
          "failed",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        orderId,
      );

    throw error;
  }
}

async function handleVerifyPayment(
  adminClient: ReturnType<typeof createClient>,
  body: JsonObject,
  keyId: string,
  keySecret: string,
): Promise<Response> {
  const orderId =
    safeString(
      body.order_id,
    );

  const razorpayOrderId =
    safeString(
      body.razorpay_order_id,
    );

  const razorpayPaymentId =
    safeString(
      body.razorpay_payment_id,
    );

  const razorpaySignature =
    safeString(
      body.razorpay_signature,
    );

  if (
    !validUuid(orderId) ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return json(
      {
        ok: false,
        error:
          "Incomplete payment verification data.",
      },
      400,
    );
  }

  const { data: order, error: orderError } =
    await adminClient
      .from("orders")
      .select(
        "id,order_number,total_amount,currency,order_status,payment_status,razorpay_order_id,razorpay_payment_id",
      )
      .eq(
        "id",
        orderId,
      )
      .maybeSingle();

  if (
    orderError ||
    !order
  ) {
    return json(
      {
        ok: false,
        error:
          "Order not found.",
      },
      404,
    );
  }

  // Idempotent verification:
  // if this order is already successfully paid, do not create another payment/order.
  if (
    order.payment_status === "paid" &&
    order.razorpay_payment_id
  ) {
    return json({
      ok: true,
      order_number:
        order.order_number,
      razorpay_payment_id:
        order.razorpay_payment_id,
      amount:
        Number(order.total_amount),
      currency:
        order.currency ||
        CURRENCY,
    });
  }

  if (
    order.razorpay_order_id !==
    razorpayOrderId
  ) {
    return json(
      {
        ok: false,
        error:
          "Razorpay order does not match this order.",
      },
      400,
    );
  }

  // Prevent one Razorpay payment from being attached to two orders.
  const { data: existingPayment } =
    await adminClient
      .from("payments")
      .select(
        "id,order_id,status",
      )
      .eq(
        "razorpay_payment_id",
        razorpayPaymentId,
      )
      .maybeSingle();

  if (
    existingPayment &&
    existingPayment.order_id !==
      orderId
  ) {
    return json(
      {
        ok: false,
        error:
          "This payment is already linked to another order.",
      },
      409,
    );
  }

  const expectedSignature =
    await hmacSha256(
      keySecret,
      `${razorpayOrderId}|${razorpayPaymentId}`,
    );

  if (
    expectedSignature !==
    razorpaySignature
  ) {
    await adminClient
      .from("payments")
      .update({
        status:
          "failed",
        failure_reason:
          "Invalid Razorpay signature.",
      })
      .eq(
        "order_id",
        orderId,
      )
      .eq(
        "razorpay_order_id",
        razorpayOrderId,
      );

    await adminClient
      .from("orders")
      .update({
        payment_status:
          "failed",
        order_status:
          "failed",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        orderId,
      );

    return json(
      {
        ok: false,
        error:
          "Payment verification failed.",
      },
      400,
    );
  }

  // Ask Razorpay directly for the payment.
  // This prevents trusting only the browser callback.
  const payment =
    await razorpayRequest(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        razorpayPaymentId,
      )}`,
      keyId,
      keySecret,
      {
        method: "GET",
      },
    );

  const paymentOrderId =
    safeString(
      payment.order_id,
    );

  const paymentAmount =
    Number(payment.amount);

  const paymentCurrency =
    safeString(
      payment.currency,
    ) || CURRENCY;

  const paymentStatus =
    safeString(
      payment.status,
    ).toLowerCase();

  if (
    paymentOrderId !==
    razorpayOrderId
  ) {
    return json(
      {
        ok: false,
        error:
          "Payment order mismatch.",
      },
      400,
    );
  }

  const expectedAmount =
    paise(
      Number(
        order.total_amount,
      ),
    );

  if (
    paymentAmount !==
    expectedAmount
  ) {
    await adminClient
      .from("payments")
      .update({
        status:
          "failed",
        failure_reason:
          "Payment amount mismatch.",
        raw_response:
          payment,
      })
      .eq(
        "order_id",
        orderId,
      );

    return json(
      {
        ok: false,
        error:
          "Payment amount does not match the order.",
      },
      400,
    );
  }

  if (
    paymentCurrency !==
    (order.currency || CURRENCY)
  ) {
    return json(
      {
        ok: false,
        error:
          "Payment currency mismatch.",
      },
      400,
    );
  }

  if (
    paymentStatus !==
      "captured" &&
    paymentStatus !==
      "authorized"
  ) {
    await adminClient
      .from("payments")
      .update({
        status:
          paymentStatus === "failed"
            ? "failed"
            : "created",
        method:
          safeString(
            payment.method,
          ) || null,
        raw_response:
          payment,
        failure_reason:
          paymentStatus === "failed"
            ? safeString(
                safeJson(
                  payment.error,
                ).description,
              ) || "Payment failed."
            : null,
      })
      .eq(
        "order_id",
        orderId,
      )
      .eq(
        "razorpay_order_id",
        razorpayOrderId,
      );

    if (
      paymentStatus ===
      "failed"
    ) {
      await adminClient
        .from("orders")
        .update({
          payment_status:
            "failed",
          order_status:
            "failed",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          orderId,
        );
    }

    return json(
      {
        ok: false,
        error:
          "Razorpay payment is not successfully captured.",
      },
      400,
    );
  }

  const finalPaymentStatus =
    paymentStatus === "captured"
      ? "captured"
      : "authorized";

  const finalOrderPaymentStatus =
    paymentStatus === "captured"
      ? "paid"
      : "authorized";

  const paidAt =
    new Date().toISOString();

  const { error: paymentUpdateError } =
    await adminClient
      .from("payments")
      .update({
        razorpay_payment_id:
          razorpayPaymentId,
        razorpay_signature:
          razorpaySignature,
        amount:
          Number(
            order.total_amount,
          ),
        currency:
          order.currency ||
          CURRENCY,
        status:
          finalPaymentStatus,
        method:
          safeString(
            payment.method,
          ) || null,
        paid_at:
          paidAt,
        raw_response:
          payment,
        failure_reason:
          null,
      })
      .eq(
        "order_id",
        orderId,
      )
      .eq(
        "razorpay_order_id",
        razorpayOrderId);

  if (paymentUpdateError) {
    throw new Error(
      "Unable to update payment record.",
    );
  }

  const { error: orderUpdateError } =
    await adminClient
      .from("orders")
      .update({
        razorpay_payment_id:
          razorpayPaymentId,
        razorpay_signature:
          razorpaySignature,
        payment_status:
          finalOrderPaymentStatus,
        order_status:
          "confirmed",
        confirmed_at:
          paidAt,
        updated_at:
          paidAt,
      })
      .eq(
        "id",
        orderId,
      );

  if (orderUpdateError) {
    throw new Error(
      "Unable to confirm order.",
    );
  }

  // Only consume stock once.
  await consumeInventory(
    adminClient,
    orderId,
  );

  await logActivity(
    adminClient,
    "payment_verified",
    orderId,
    `Razorpay payment verified for order ${order.order_number}.`,
    {
      order_number:
        order.order_number,
      razorpay_order_id:
        razorpayOrderId,
      razorpay_payment_id:
        razorpayPaymentId,
      amount:
        Number(order.total_amount),
      currency:
        order.currency ||
        CURRENCY,
      payment_status:
        finalPaymentStatus,
    },
  );

  return json({
    ok: true,
    order_number:
      order.order_number,
    razorpay_payment_id:
      razorpayPaymentId,
    amount:
      Number(order.total_amount),
    currency:
      order.currency ||
      CURRENCY,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  }

  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        error:
          "Method not allowed.",
      },
      405,
    );
  }

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL",
    );

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  const razorpayKeyId =
    Deno.env.get(
      "RAZORPAY_KEY_ID",
    );

  const razorpayKeySecret =
    Deno.env.get(
      "RAZORPAY_KEY_SECRET",
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return json(
      {
        ok: false,
        error:
          "Supabase server configuration is missing.",
      },
      500,
    );
  }

  if (
    !razorpayKeyId ||
    !razorpayKeySecret
  ) {
    return json(
      {
        ok: false,
        error:
          "Razorpay server configuration is missing.",
      },
      500,
    );
  }

  let body: JsonObject;

  try {
    body =
      safeJson(
        await req.json(),
      );
  } catch {
    return json(
      {
        ok: false,
        error:
          "Invalid JSON request.",
      },
      400,
    );
  }

  const action =
    safeString(
      body.action,
    );

  if (
    action !== "create_order" &&
    action !== "verify_payment"
  ) {
    return json(
      {
        ok: false,
        error:
          "Unsupported checkout action.",
      },
      400,
    );
  }

  const adminClient =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  try {
    if (
      action === "create_order"
    ) {
      return await handleCreateOrder(
        adminClient,
        body,
        razorpayKeyId,
        razorpayKeySecret,
      );
    }

    return await handleVerifyPayment(
      adminClient,
      body,
      razorpayKeyId,
      razorpayKeySecret,
    );
  } catch (error) {
    console.error(
      "razorpay-checkout error:",
      error,
    );

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Secure checkout failed. Please try again.",
      },
      500,
    );
  }
});
