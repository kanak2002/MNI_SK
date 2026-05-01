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

const sensitiveSignals = [
  "address",
  "bank",
  "card",
  "credit",
  "debit",
  "email",
  "health",
  "home",
  "id",
  "medical",
  "passport",
  "password",
  "payment",
  "phone",
  "ssn",
  "social security",
];

const externalActionSignals = [
  "agent",
  "airline",
  "amazon",
  "appointment",
  "book",
  "buy",
  "calendar",
  "checkout",
  "delivery",
  "flight",
  "hotel",
  "order",
  "pay",
  "purchase",
  "reserve",
  "schedule",
  "send",
  "shop",
  "submit",
  "ticket",
];

const confirmationSignals = [
  "bank",
  "card",
  "checkout",
  "credit",
  "debit",
  "finalize",
  "id",
  "login",
  "passport",
  "password",
  "pay",
  "payment",
  "purchase",
  "send my",
  "share my",
  "ssn",
  "submit",
  "use my card",
];

function waitForMockResponse() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);
  });
}

function normalizeMessage(message = "") {
  return message.toLowerCase();
}

function hasAnyTerm(message, terms) {
  const normalizedMessage = normalizeMessage(message);
  return terms.some((term) => normalizedMessage.includes(term));
}

function getSelectedPersona(persona) {
  return personas.find((item) => item.id === persona?.id) || personas[1];
}

function inferTaskContext(message) {
  const normalized = normalizeMessage(message);
  const requiresExternalAction = hasAnyTerm(normalized, externalActionSignals);
  const mentionsSensitiveData = hasAnyTerm(normalized, sensitiveSignals);
  const requiresConfirmationData = hasAnyTerm(normalized, confirmationSignals);

  if (hasAnyTerm(normalized, ["flight", "airline", "airport", "ticket"])) {
    return {
      destination: "Travel provider",
      requiredData: ["Route", "Passenger count", "Timing preference"],
      sensitiveData: ["Legal name", "Payment method", "Passport or government ID"],
      protectedData: ["Passport or government ID", "Payment details", "Unrelated travel history"],
      alternative: "Search with route, passenger count, and a flexible travel window first.",
      blocked: ["Passport or government ID", "Payment details"],
      requiresExternalAction,
      mentionsSensitiveData: true,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["hotel", "room", "stay", "reserve"])) {
    return {
      destination: "Hotel or booking provider",
      requiredData: ["City or area", "Stay dates", "Guest count"],
      sensitiveData: ["Name", "Payment method", "Exact address"],
      protectedData: ["Home address", "Saved payment credentials", "Government ID"],
      alternative: "Search by city or neighborhood and hold payment details until checkout.",
      blocked: ["Saved payment credentials", "Government ID"],
      requiresExternalAction,
      mentionsSensitiveData: true,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["buy", "order", "shop", "shopping", "purchase", "checkout"])) {
    return {
      destination: "Retailer or marketplace",
      requiredData: ["Item", "Quantity", "Preferences"],
      sensitiveData: ["Payment method", "Shipping address", "Account details"],
      protectedData: ["Account password", "Saved cards not selected", "Unrelated purchase history"],
      alternative: "Prepare the cart using product preferences and use delivery area instead of full address.",
      blocked: ["Account password", "Unrelated purchase history"],
      requiresExternalAction,
      mentionsSensitiveData: true,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["calendar", "appointment", "meeting", "schedule"])) {
    return {
      destination: "Calendar or scheduling provider",
      requiredData: ["Event title", "Preferred time", "Duration"],
      sensitiveData: ["Full calendar details", "Private notes", "Unrelated attendees"],
      protectedData: ["Existing event titles", "Private notes", "Unrelated calendar locations"],
      alternative: "Use free/busy windows instead of exposing full calendar details.",
      blocked: ["Private notes", "Unrelated calendar content"],
      requiresExternalAction,
      mentionsSensitiveData,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["email", "message", "send", "contact"])) {
    return {
      destination: "Message recipient or communication service",
      requiredData: ["Message content", "Recipient"],
      sensitiveData: ["Email address", "Phone number", "Private context"],
      protectedData: ["Unrelated contacts", "Private account data", "Precise location"],
      alternative: "Draft the message in chat and let you send it manually.",
      blocked: ["Unrelated contacts", "Private account data"],
      requiresExternalAction,
      mentionsSensitiveData,
      requiresConfirmationData,
    };
  }

  return {
    destination: requiresExternalAction ? "Requested external service" : "None",
    requiredData: ["User-provided task details"],
    sensitiveData: mentionsSensitiveData
      ? ["Sensitive details mentioned in the task"]
      : ["No sensitive data required"],
    protectedData: ["Personal identifiers", "Account data", "Payment data", "Precise location"],
    alternative: requiresExternalAction
      ? "Continue with only the minimum task details and avoid sensitive fields."
      : null,
    blocked: ["Unnecessary personal details", "Unneeded third-party sharing"],
    requiresExternalAction,
    mentionsSensitiveData,
    requiresConfirmationData,
  };
}

function personaRequiresConfirmation(persona, context) {
  if (context.requiresConfirmationData) return true;
  if (persona.id === "conservative") {
    return context.requiresExternalAction && context.mentionsSensitiveData;
  }
  if (persona.id === "balanced") {
    return context.requiresExternalAction && context.mentionsSensitiveData && !context.alternative;
  }
  return context.requiresExternalAction && context.requiresConfirmationData;
}

function canUseSaferAlternative(persona, context) {
  if (!context.alternative) return false;
  if (context.requiresConfirmationData) return false;
  if (persona.id === "convenience" && !context.mentionsSensitiveData) return false;
  return context.requiresExternalAction || context.mentionsSensitiveData;
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

function createAlternativeReceipt(task, context) {
  return {
    type: "full",
    task,
    completed: true,
    shared: context.requiredData.map((data) => ({
      data,
      party: context.destination,
    })),
    protected: context.protectedData,
    blocked: context.blocked.map((data) => ({
      data,
      party: context.destination,
      reason: "Not required for the safer alternative.",
    })),
    substitutions: [
      {
        original: context.sensitiveData.join(", "),
        substitute: context.alternative,
      },
    ],
    deleted_after_task: true,
  };
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

function baseDecisions(context, persona) {
  return [
    {
      action: "Analyze task and required data",
      third_party: context.destination,
      decision: "permit",
      reason: `${persona.name} allows the task analysis using only the message you provided.`,
      data_required: context.requiredData,
      protected_data: [],
      confirmation_required: false,
      substitute_with: null,
    },
    {
      action: "Cross-check selected persona rules",
      third_party: "PersonaGuard",
      decision: "permit",
      reason: `${persona.name} rules were applied before any external action or sensitive sharing.`,
      data_required: [persona.name],
      protected_data: persona.rules,
      confirmation_required: false,
      substitute_with: null,
    },
  ];
}

function allowedResponse(message, persona, context) {
  return {
    assistant_message:
      "I analyzed the task and cross-checked it against your selected persona. This can continue without sensitive sharing or external approval.",
    decisions: [
      ...baseDecisions(context, persona),
      {
        action: "Continue safely",
        third_party: context.destination,
        decision: "permit",
        reason: "The task can proceed with low-risk data only.",
        data_required: context.requiredData,
        protected_data: context.protectedData,
        confirmation_required: false,
        substitute_with: null,
      },
      {
        action: "Block unnecessary sensitive data",
        third_party: context.destination,
        decision: "block",
        reason: "PersonaGuard does not need identifiers, account access, payment data, or precise location for this step.",
        data_required: [],
        protected_data: context.protectedData,
        confirmation_required: false,
        substitute_with: null,
      },
    ],
    confirmation: null,
    receipt: createSummaryReceipt(message, context.protectedData),
  };
}

function alternativeResponse(message, persona, context) {
  return {
    assistant_message: `I analyzed the task and found a safer path under ${persona.name}. I will continue with this alternative: ${context.alternative}`,
    decisions: [
      ...baseDecisions(context, persona),
      {
        action: "Use safer alternative",
        third_party: context.destination,
        decision: "substitute",
        reason: "The original path could expose sensitive or unnecessary data, but a lower-risk substitute can still move the task forward.",
        data_required: context.sensitiveData,
        protected_data: context.protectedData,
        confirmation_required: false,
        substitute_with: context.alternative,
      },
      {
        action: "Block unnecessary disclosure",
        third_party: context.destination,
        decision: "block",
        reason: "PersonaGuard blocks data that is not required for the safer alternative.",
        data_required: [],
        protected_data: context.blocked,
        confirmation_required: false,
        substitute_with: null,
      },
    ],
    confirmation: null,
    receipt: createAlternativeReceipt(message, context),
  };
}

function confirmationResponse(persona, context) {
  return {
    assistant_message:
      "I analyzed the task and cross-checked it against your selected persona. There is no safe alternative that can complete this action without sharing sensitive data, so I need your confirmation before continuing.",
    decisions: [
      ...baseDecisions(context, persona),
      {
        action: "Require confirmation before execution",
        third_party: context.destination,
        decision: "confirm",
        reason: `${persona.name} requires approval before this sensitive action can proceed.`,
        data_required: context.sensitiveData,
        protected_data: context.protectedData,
        confirmation_required: true,
        substitute_with: null,
      },
      {
        action: "Block execution until approved",
        third_party: context.destination,
        decision: "block",
        reason: "No sensitive data is shared unless you approve the confirmation card.",
        data_required: [],
        protected_data: context.protectedData,
        confirmation_required: true,
        substitute_with: null,
      },
    ],
    confirmation: {
      required: true,
      title: "Approve sensitive data sharing?",
      message:
        "PersonaGuard needs your approval because this action cannot continue safely without the listed sensitive data.",
      action: "Continue requested task",
      third_party: context.destination,
      trusted: false,
      data_required: context.sensitiveData,
      protected_data: context.protectedData,
      blocked_data: context.blocked,
      substitutions: [],
    },
    receipt: null,
  };
}

function responseForMessage(message, personaPayload) {
  const persona = getSelectedPersona(personaPayload);
  const context = inferTaskContext(message);

  if (canUseSaferAlternative(persona, context)) {
    return alternativeResponse(message, persona, context);
  }

  if (personaRequiresConfirmation(persona, context)) {
    return confirmationResponse(persona, context);
  }

  return allowedResponse(message, persona, context);
}

export async function sendChatMessage(payload) {
  await waitForMockResponse();

  return responseForMessage(payload.message || "", payload.persona);
}

export async function sendConfirmationChoice(payload) {
  await waitForMockResponse();

  if (payload.choice === "yes") {
    return {
      assistant_message:
        "Approved. I will continue execution using only the approved data and keep the rest protected.",
      confirmation: null,
      receipt: createFullReceipt(payload),
    };
  }

  if (payload.choice === "no") {
    return {
      assistant_message:
        "Cancelled. I did not share the sensitive data for this action.",
      confirmation: null,
      receipt: null,
    };
  }

  return {
    assistant_message:
      "Safer alternative: I can continue with lower-risk data only, avoid external services, or leave the sensitive step for you to complete manually.",
    confirmation: null,
    receipt: null,
  };
}
