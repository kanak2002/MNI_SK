export const personas = [
  {
    id: "conservative",
    name: "Conservative",
    tone: "Maximum caution",
    summary: "Ask before using sensitive details and prefer safer substitutes.",
    rules: [
      "I will ask before sharing personal, financial, health, travel, or account data.",
      "I will use placeholders and summaries whenever exact details are not required.",
      "I will block unnecessary third-party sharing by default.",
    ],
  },
  {
    id: "balanced",
    name: "Balanced",
    tone: "Recommended",
    summary: "Minimize exposed data while keeping tasks practical.",
    rules: [
      "I will share only the minimum details needed to complete your task.",
      "I will mask direct identifiers when a substitute can still work.",
      "I will ask for confirmation before higher-risk sharing.",
    ],
  },
  {
    id: "convenience",
    name: "Convenience-First",
    tone: "Faster tasks",
    summary: "Move quickly, but still flag clearly sensitive actions.",
    rules: [
      "I will proceed with routine low-risk task details.",
      "I will warn before sharing financial, health, identity, or precise location data.",
      "I will keep a receipt of what was shared, protected, substituted, or blocked.",
    ],
  },
];

const MOCK_RESPONSE_DELAY_MS = 450;

function waitForMockResponse() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);
  });
}

function hasAnyTerm(message, terms) {
  const normalizedMessage = message.toLowerCase();
  return terms.some((term) => normalizedMessage.includes(term));
}

function createSummaryReceipt(task, protectedItems) {
  return {
    type: "summary",
    task,
    completed: true,
    shared: [],
    protected: protectedItems,
    blocked: [],
    substitutions: [],
    deleted_after_task: true,
  };
}

function simpleTaskResponse(message) {
  return {
    assistant_message:
      "This can be handled inside PersonaGuard chat without contacting external services. Share the study topic, notes, or question you want help with, and I will keep personal records out of the task.",
    decisions: [
      {
        action: "Handle request inside chat",
        third_party: "None",
        decision: "permit",
        reason: "This task can be completed without contacting an external service.",
        data_required: ["User-provided message only"],
        substitute_with: null,
      },
      {
        action: "Protect personal records",
        third_party: "None",
        decision: "block",
        reason: "No academic records, accounts, or sensitive documents are shared.",
        data_required: [],
        substitute_with: null,
      },
    ],
    confirmation: null,
    receipt: createSummaryReceipt(message, [
      "Personal records",
      "Account data",
      "Private documents",
    ]),
  };
}

function flightTaskResponse() {
  return {
    assistant_message:
      "I analyzed the flight booking request for privacy requirements. Flight booking can involve identity, payment, and travel-pattern data, so I will minimize what is shared and ask before sending sensitive details.",
    decisions: [
      {
        action: "Search route and availability",
        third_party: "Airline or booking service",
        decision: "permit",
        reason: "Route, passenger count, and broad timing can be used before identity details are required.",
        data_required: ["Origin", "Destination", "Passenger count"],
        substitute_with: null,
      },
      {
        action: "Use flexible travel date first",
        third_party: "Airline or booking service",
        decision: "substitute",
        reason: "A flexible date range reduces exposure of exact travel plans during early search.",
        data_required: ["Exact travel date"],
        substitute_with: "Flexible date window",
      },
      {
        action: "Share passenger and payment details only after approval",
        third_party: "Airline or booking service",
        decision: "confirm",
        reason: "Legal name, exact travel date, and payment details are sensitive booking data.",
        data_required: ["Passenger name", "Payment method", "Travel date"],
        substitute_with: null,
      },
      {
        action: "Block unrelated identity documents",
        third_party: "Airline or booking service",
        decision: "block",
        reason: "Passport or government ID is not shared until the selected itinerary requires it.",
        data_required: [],
        substitute_with: null,
      },
    ],
    confirmation: {
      required: true,
      title: "Approve flight booking details?",
      message:
        "PersonaGuard needs your approval before sharing passenger name, payment method, and exact travel date with an airline or booking service.",
      action: "Share required flight booking details",
      third_party: "Airline or booking service",
      trusted: true,
      data_required: ["Passenger name", "Payment method", "Travel date"],
      protected_data: ["Passport number", "Loyalty account", "Unrelated identity documents"],
      blocked_data: ["Unrelated identity documents"],
      substitutions: [
        {
          original: "Exact travel date during search",
          substitute: "Flexible date window",
        },
      ],
    },
    receipt: null,
  };
}

function hotelTaskResponse() {
  return {
    assistant_message:
      "I analyzed the hotel booking request for privacy requirements. I can use non-identifying stay preferences first, substitute broader location data, and ask before sharing payment or contact details.",
    decisions: [
      {
        action: "Search stays by basic preferences",
        third_party: "Selected hotel provider",
        decision: "permit",
        reason: "Guest count, dates, and room preferences can start the booking flow.",
        data_required: ["Stay dates", "Guest count", "Room preference"],
        substitute_with: null,
      },
      {
        action: "Use city-level location",
        third_party: "Selected hotel provider",
        decision: "substitute",
        reason: "City-level search avoids exposing exact address or precise location.",
        data_required: ["Precise location"],
        substitute_with: "City or neighborhood only",
      },
      {
        action: "Approve contact and payment details",
        third_party: "Selected hotel provider",
        decision: "confirm",
        reason: "Name, email, and payment information are sensitive and should be approved first.",
        data_required: ["Name", "Email", "Payment method"],
        substitute_with: null,
      },
      {
        action: "Block tracking and personalization",
        third_party: "Selected hotel provider",
        decision: "block",
        reason: "Marketing tracking, profile enrichment, and unrelated personalization are not required for booking.",
        data_required: [],
        substitute_with: null,
      },
    ],
    confirmation: {
      required: true,
      title: "Approve hotel booking details?",
      message:
        "PersonaGuard needs your approval before sharing name, email, and payment information with the selected hotel provider.",
      action: "Share required hotel booking details",
      third_party: "Selected hotel provider",
      trusted: true,
      data_required: ["Name", "Email", "Payment method"],
      protected_data: ["Home address", "Government ID", "Saved payment credentials"],
      blocked_data: ["Tracking data", "Personalization profile"],
      substitutions: [
        {
          original: "Precise location",
          substitute: "City or neighborhood only",
        },
      ],
    },
    receipt: null,
  };
}

function calendarTaskResponse() {
  return {
    assistant_message:
      "I analyzed the calendar scheduling request for privacy requirements. Calendar tasks can reveal availability, event context, and contacts, so I will share only what is needed for scheduling.",
    decisions: [
      {
        action: "Prepare event details",
        third_party: "Calendar provider",
        decision: "permit",
        reason: "Event title, time, and duration are needed to create or coordinate the appointment.",
        data_required: ["Event title", "Event time", "Duration"],
        substitute_with: null,
      },
      {
        action: "Use free/busy availability",
        third_party: "Calendar provider",
        decision: "substitute",
        reason: "Free/busy windows avoid exposing unrelated calendar entries.",
        data_required: ["Full calendar details"],
        substitute_with: "Free/busy availability only",
      },
      {
        action: "Approve external calendar sync",
        third_party: "Calendar provider",
        decision: "confirm",
        reason: "External sync may share event title, time, attendee, and reminder data.",
        data_required: ["Event title", "Event time", "Attendee or provider"],
        substitute_with: null,
      },
      {
        action: "Block unrelated calendar content",
        third_party: "Calendar provider",
        decision: "block",
        reason: "Existing event titles, attendees, notes, and locations are not needed.",
        data_required: [],
        substitute_with: null,
      },
    ],
    confirmation: {
      required: true,
      title: "Approve calendar sync?",
      message:
        "PersonaGuard needs your approval before sharing event title, time, and scheduling details with an external calendar provider.",
      action: "Sync limited calendar event",
      third_party: "Calendar provider",
      trusted: true,
      data_required: ["Event title", "Event time", "Attendee or provider"],
      protected_data: ["Existing event titles", "Private notes", "Unrelated attendees", "Unrelated locations"],
      blocked_data: ["Existing event titles", "Private notes", "Unrelated attendees"],
      substitutions: [
        {
          original: "Full calendar details",
          substitute: "Free/busy availability only",
        },
      ],
    },
    receipt: null,
  };
}

function shoppingTaskResponse() {
  return {
    assistant_message:
      "I analyzed the shopping request for privacy requirements. I can separate product selection from checkout details and ask before purchase, payment, or shipping data is shared.",
    decisions: [
      {
        action: "Search or prepare cart from item preferences",
        third_party: "Retailer or marketplace",
        decision: "permit",
        reason: "Product, quantity, and preference details can be used before checkout.",
        data_required: ["Product", "Quantity", "Preferences"],
        substitute_with: null,
      },
      {
        action: "Use delivery area before exact address",
        third_party: "Retailer or marketplace",
        decision: "substitute",
        reason: "A delivery area is enough for estimates before purchase.",
        data_required: ["Full shipping address"],
        substitute_with: "Delivery area or ZIP code",
      },
      {
        action: "Approve purchase and payment details",
        third_party: "Retailer or marketplace",
        decision: "confirm",
        reason: "Purchase completion requires payment and shipping data.",
        data_required: ["Payment method", "Shipping address", "Order contents"],
        substitute_with: null,
      },
      {
        action: "Block account credentials and unrelated profile data",
        third_party: "Retailer or marketplace",
        decision: "block",
        reason: "Passwords, saved cards, and unrelated purchase history are not needed.",
        data_required: [],
        substitute_with: null,
      },
    ],
    confirmation: {
      required: true,
      title: "Approve purchase details?",
      message:
        "PersonaGuard needs your approval before sharing payment, shipping, and order details with a retailer or marketplace.",
      action: "Share checkout details",
      third_party: "Retailer or marketplace",
      trusted: true,
      data_required: ["Payment method", "Shipping address", "Order contents"],
      protected_data: ["Account password", "Saved cards not selected", "Unrelated purchase history"],
      blocked_data: ["Account password", "Unrelated profile data"],
      substitutions: [
        {
          original: "Full shipping address before checkout",
          substitute: "Delivery area or ZIP code",
        },
      ],
    },
    receipt: null,
  };
}

function unknownTaskResponse(message) {
  return {
    assistant_message:
      "I can help with that. I’ll first check what data is required and avoid external sharing unless it is necessary.",
    decisions: [
      {
        action: "Start inside chat",
        third_party: "None",
        decision: "permit",
        reason: "I can clarify the task before using any external service.",
        data_required: ["User-provided message only"],
        substitute_with: null,
      },
      {
        action: "Protect sensitive data by default",
        third_party: "None",
        decision: "block",
        reason: "Personal details, account access, payment data, and precise location are not shared unless required and approved.",
        data_required: [],
        substitute_with: null,
      },
      {
        action: "No confirmation needed",
        third_party: "None",
        decision: "permit",
        reason: "No external action or sensitive sharing is needed yet.",
        data_required: [],
        substitute_with: null,
      },
    ],
    confirmation: null,
    receipt: createSummaryReceipt(message, [
      "Personal details",
      "Account data",
      "Payment data",
      "Precise location",
    ]),
  };
}

function responseForMessage(message) {
  if (
    hasAnyTerm(message, [
      "study",
      "studies",
      "homework",
      "notes",
      "learn",
      "explain",
      "machine learning",
      "practice",
      "brainstorm",
      "draft",
      "write notes",
    ])
  ) {
    return simpleTaskResponse(message);
  }

  if (hasAnyTerm(message, ["flight", "airline", "airport", "plane", "ticket"])) {
    return flightTaskResponse();
  }

  if (hasAnyTerm(message, ["hotel", "stay", "room", "booking"])) {
    return hotelTaskResponse();
  }

  if (hasAnyTerm(message, ["calendar", "appointment", "schedule", "meeting", "dentist"])) {
    return calendarTaskResponse();
  }

  if (hasAnyTerm(message, ["buy", "order", "shopping", "groceries", "amazon", "purchase"])) {
    return shoppingTaskResponse();
  }

  return unknownTaskResponse(message);
}

function createFullReceipt({ task, confirmation }) {
  const thirdParty = confirmation?.third_party || "Approved third party";

  return {
    type: "full",
    task,
    completed: true,
    shared: (confirmation?.data_required || []).map((data) => ({
      data,
      party: thirdParty,
    })),
    protected: confirmation?.protected_data || [],
    blocked: (confirmation?.blocked_data || []).map((data) => ({
      data,
      party: thirdParty,
      reason: "Not required for the approved action.",
    })),
    substitutions: confirmation?.substitutions || [],
    deleted_after_task: true,
  };
}

export async function sendChatMessage(payload) {
  await waitForMockResponse();

  return responseForMessage(payload.message || "");
}

export async function sendConfirmationChoice(payload) {
  await waitForMockResponse();

  if (payload.choice === "yes") {
    return {
      assistant_message: "Approved. I’ll proceed using the privacy-safe path.",
      confirmation: null,
      receipt: createFullReceipt(payload),
    };
  }

  if (payload.choice === "no") {
    return {
      assistant_message: "Cancelled. I did not share the sensitive data for this action.",
      confirmation: null,
      receipt: null,
    };
  }

  return {
    assistant_message:
      "Safer alternative: I can continue using only lower-risk data, avoid external services, or ask you to manually complete the sensitive step.",
    confirmation: null,
    receipt: null,
  };
}
