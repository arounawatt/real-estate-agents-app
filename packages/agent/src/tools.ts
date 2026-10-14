/**
 * Outils exposés au modèle.
 *
 * Règles qui gouvernent ce fichier :
 *
 *  · Noms et descriptions EN ANGLAIS. Les modèles sont massivement
 *    entraînés sur de la documentation technique anglaise : `search_properties`
 *    est choisi plus fiablement que `rechercher_biens`.
 *
 *  · `tenantId` n'est JAMAIS un paramètre du modèle. Il est injecté par le
 *    code appelant. Le modèle ne doit pas pouvoir le nommer, donc pas
 *    pouvoir en changer.
 *
 *  · Chaque enum porte une porte de sortie (`to_qualify`). Sans elle, le
 *    modèle invente une valeur plausible pour satisfaire le schéma.
 *
 *  · Aucune requête libre, aucun SQL. Paramètres fermés uniquement.
 */

export const saveQualificationTool = {
  name: 'save_qualification',
  description:
    'Record what the prospect has revealed. Call it as soon as a fact is stated, ' +
    'not at the end of the conversation. Never ask for a field again once known. ' +
    'Use "to_qualify" whenever the prospect has not said — never guess a plausible value.',
  input_schema: {
    type: 'object' as const,
    properties: {
      lead_id: { type: 'string' },
      intent: { type: 'string', enum: ['purchase', 'rental', 'investment', 'to_qualify'] },
      property_type: {
        type: 'string',
        enum: ['apartment', 'villa', 'land', 'commercial', 'to_qualify'],
      },
      zone: { type: 'string', description: "One of the agency's zones, or 'other'." },
      budget_amount: { type: 'integer', description: 'In XOF. Omit if not stated.' },
      timeline: {
        type: 'string',
        enum: ['immediate', 'three_months', 'six_months', 'later', 'to_qualify'],
      },
      notes: {
        type: 'string',
        description:
          'Free text for what fits no field — "wants a sea view", "coming back in December". ' +
          'Never store anything about origin, religion, family situation, health or disability.',
      },
    },
    required: ['lead_id'],
  },
}

export const searchPropertiesTool = {
  name: 'search_properties',
  description:
    'Search the agency catalogue. Only published listings are returned — an ' +
    'unpublished property does not exist for you. A prospect almost always names a ' +
    'NEIGHBOURHOOD (Mermoz, Plateau, Ngor…) — pass that as district, not city. city is ' +
    'the city itself (Dakar, Saly…), rarely what a prospect actually says.',
  input_schema: {
    type: 'object' as const,
    properties: {
      transaction: { type: 'string', enum: ['sale', 'long_term_rental', 'short_term_rental'] },
      type: { type: 'string', enum: ['apartment', 'villa', 'land', 'commercial'] },
      city: { type: 'string', description: 'The city itself, e.g. Dakar, Saly.' },
      district: { type: 'string', description: 'The neighbourhood, e.g. Mermoz, Plateau, Ngor.' },
      max_price: {
        type: 'integer',
        description:
          'Tolerance of +20% is applied automatically — a result can come back above this '
          + 'value. Always state the real price field to the prospect; if it is above what '
          + 'they said, say so honestly (e.g. "légèrement au-dessus de ton budget"). Never '
          + 'state a price that is not the exact price field from this tool.',
      },
    },
  },
}

export const getPropertyTool = {
  name: 'get_property',
  description:
    'Full details of one property, including its listing_url when one exists. ' +
    'When presenting these details to the prospect, if listing_url is present, ALWAYS ' +
    'share it too and invite them to see more there (photos, full description…). ' +
    'If listing_url is null, say you have no page to send — never build a URL ' +
    'from the reference, it would produce dead links sent to real buyers.',
  input_schema: {
    type: 'object' as const,
    properties: { property_id: { type: 'string' } },
    required: ['property_id'],
  },
}

export const offerVisitTool = {
  name: 'offer_visit',
  description:
    "Get the agency's booking link for this intent, and record the visit request. " +
    'Returns {mode: "link", url} or {mode: "callback"}. When it returns "callback", ' +
    'tell the prospect an adviser will call back to arrange a slot, and escalate. ' +
    'Never construct the URL yourself.',
  input_schema: {
    type: 'object' as const,
    properties: {
      lead_id: { type: 'string' },
      intent: { type: 'string', enum: ['purchase', 'rental'] },
      property_id: { type: 'string' },
    },
    required: ['lead_id', 'intent'],
  },
}

/* Les quatre faits fermés du §3, partagés par open_ticket et update_ticket.
   Pas de « to_qualify » ici : un fait inconnu est un champ OMIS, et la
   colonne reste vide en base. C'est la même porte de sortie, sans valeur
   factice — le modèle n'est jamais forcé de deviner. */
const TICKET_FACT_PROPERTIES = {
  habitable: {
    type: 'string', enum: ['yes', 'no', 'partly'],
    description: 'Can the tenant still live normally in the home? Omit until the tenant has said.',
  },
  utility_cut: {
    type: 'string', enum: ['none', 'water', 'power', 'water_and_power'],
    description: 'Is water or electricity cut? Omit until the tenant has said.',
  },
  safety_risk: {
    type: 'boolean',
    description: 'A door or window that no longer locks, or a dangerous installation. Omit until known.',
  },
  worsening: {
    type: 'boolean',
    description: 'Is the situation getting worse right now? Omit until known.',
  },
  safety_reason: {
    type: 'string', enum: ['gas_leak', 'fire', 'flooding', 'dangerous_electrical', 'injury'],
    description:
      'ONLY for gas smell, fire or smoke, flooding in progress (water invading the home and '
      + 'rising — NOT a leak or water dripping from the ceiling), sparking or smoking electrical '
      + 'installation, or an injured person. Triggers the safety path. Never set it otherwise.',
  },
} as const

export const openTicketTool = {
  name: 'open_ticket',
  description:
    'Open a maintenance ticket AS SOON AS you know two things: which property the tenant '
    + 'rents (in their own words) and what the problem is. Their phone number is already '
    + 'known — never ask for it. Do not wait for the four facts: open first, then ask them '
    + 'one at a time and record each with update_ticket. Do NOT assess urgency yourself, it '
    + 'is computed from the facts. Never open a second ticket for a problem that already '
    + 'has an open one — use update_ticket instead. Photos the tenant sends are attached '
    + 'automatically.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject_as_declared: {
        type: 'string',
        description:
          "The tenant's own words for which property or address they rent, e.g. \"Mermoz, "
          + '4e étage porte A". Copy them, do not normalise or complete them.',
      },
      nature: {
        type: 'string',
        enum: ['plumbing', 'electricity', 'air_conditioning', 'locksmith', 'gas', 'admin', 'other'],
        description: 'Use "other" when none fits — never force a category.',
      },
      description: {
        type: 'string',
        description: "The problem in the tenant's own words, short. No diagnosis, no cause you inferred.",
      },
      ...TICKET_FACT_PROPERTIES,
    },
    required: ['subject_as_declared', 'nature', 'description'],
  },
}

export const updateTicketTool = {
  name: 'update_ticket',
  description:
    'Record a newly stated fact on an open ticket. Call it as soon as the tenant answers '
    + 'one of the four questions, or when the situation changes ("now it is overflowing"): '
    + 'urgency is recomputed by the system. Only pass the fields the tenant just stated.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ticket_id: { type: 'string' },
      description: { type: 'string', description: "Replaces the problem description, in the tenant's words." },
      ...TICKET_FACT_PROPERTIES,
    },
    required: ['ticket_id'],
  },
}

export const triggerSafetyPathTool = {
  name: 'trigger_safety_path',
  description:
    'A leak, water damage, water dripping from the ceiling, a power cut or a broken air '
    + 'conditioner is NOT a safety case — it is an ordinary ticket. '
    + 'Call IMMEDIATELY on gas smell, fire or smoke, flooding in progress, sparking or smoking '
    + 'electrical installation, or an injured person — even before any ticket exists, even '
    + 'before knowing the property. Alerts a human right away and returns the emergency '
    + 'numbers configured by the agency, which you must give the tenant with the safety '
    + 'instruction: cut the supply if safe, leave the home, call emergency services.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string', enum: ['gas_leak', 'fire', 'flooding', 'dangerous_electrical', 'injury'] },
      ticket_id: {
        type: 'string',
        description: 'ONLY if the danger IS the problem of that open ticket (sparks on an open '
          + 'electricity ticket). A danger unrelated to the open tickets (gas smell while a '
          + 'ventilation ticket is open) is a NEW problem: omit ticket_id, then open a dedicated '
          + 'ticket with open_ticket, setting safety_reason.',
      },
    },
    required: ['reason'],
  },
}

export const getAgencyInfoTool = {
  name: 'get_agency_info',
  description:
    "The agency's address, phone, email and opening hours, exactly as the agency entered "
    + 'them. Call it whenever the person asks where the agency is, when it is open or how to '
    + 'reach it. Give only what they asked for, word for word. A null field is one you do not '
    + 'have: say so, never complete or guess it. Never offer the phone number on your own as '
    + 'an alternative to a visit or a callback — the agency calls the client back, not the reverse.',
  input_schema: {
    type: 'object' as const,
    properties: {},
  },
}

export const escalateTool = {
  name: 'escalate_to_human',
  description:
    'Hand over to an adviser. Call it for any legal, tax or financial question, ' +
    'any discriminatory request, when the person asks for a human, when they are ' +
    'upset, or after three turns without progress. WHEN IN DOUBT, CALL IT: a ' +
    'needless escalation costs the agency a minute, a missed one costs a client. ' +
    'You keep answering green-zone questions afterwards — do not go silent.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string' },
      trigger: {
        type: 'string',
        enum: ['red_zone', 'user_asked', 'distress', 'no_progress', 'safety'],
      },
    },
    required: ['reason', 'trigger'],
  },
}

export const fetchListingTool = {
  name: 'fetch_listing',
  description:
    "Read one of THE AGENCY'S OWN online listings and prefill a property form. " +
    'Leave any field the listing does not state empty and flag it — never infer ' +
    'a surface or a price. Refuse URLs belonging to another agency.',
  input_schema: {
    type: 'object' as const,
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
}

export const SALES_TOOLS = [
  saveQualificationTool, searchPropertiesTool, getPropertyTool,
  offerVisitTool, getAgencyInfoTool, escalateTool,
]

export const PROPERTY_MANAGER_TOOLS = [
  openTicketTool, updateTicketTool, triggerSafetyPathTool, getAgencyInfoTool, escalateTool,
]

export const CATALOGUE_TOOLS = [fetchListingTool]
