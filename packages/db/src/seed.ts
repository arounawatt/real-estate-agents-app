/**
 * Amorce de données pour le développement local.
 *
 * Un seul tenant, un contact, un lead — juste assez pour qu'une page de
 * détail ait quelque chose de réel à afficher. Pas un jeu de données de
 * démonstration complet : la maquette (`docs/maquette-dashboard.html`) en
 * a un, mais il contient des champs qu'on ne sait pas produire honnêtement
 * (score de lead) — on ne le reproduit pas ici.
 *
 * `pnpm db:seed` — à ne lancer que sur une base de développement.
 */
import { db } from './client.js'
import {
  contacts, conversations, leads, messages, properties, tenants, tickets, visitRequests,
} from './schema.js'

type ThreadLine = { dir: 'in' | 'out'; text: string; atMinutes: number }

/** Insère une conversation et son fil, avec de vrais horodatages dérivés
 *  d'une base — jamais du texte affiché tel quel, pour que sentAt reste
 *  utilisable par getResponseTimesByDay() et le tri chronologique. */
async function insertThread(opts: {
  tenantId: string
  contactId: string
  profile: 'sales' | 'property_manager' | 'catalogue' | 'assistant'
  base: Date
  lines: ThreadLine[]
}) {
  const [conversation] = await db.insert(conversations).values({
    tenantId: opts.tenantId,
    contactId: opts.contactId,
    profile: opts.profile,
    createdAt: opts.base,
    lastInboundAt: new Date(opts.base.getTime() + Math.max(...opts.lines.map((l) => l.atMinutes)) * 60_000),
  }).returning()
  if (!conversation) throw new Error('Échec de création de la conversation')

  await db.insert(messages).values(opts.lines.map((line) => ({
    tenantId: opts.tenantId,
    conversationId: conversation.id,
    direction: line.dir === 'in' ? 'inbound' as const : 'outbound' as const,
    body: line.text,
    sentAt: new Date(opts.base.getTime() + line.atMinutes * 60_000),
  })))

  return conversation
}

async function main() {
  const [tenant] = await db.insert(tenants).values({
    name: 'Résidences Atlantique',
    plan: 'complete',
    listingDomains: ['residences-atlantique.sn'],
    bookingUrlRental: 'https://calendly.com/residences-atlantique/visite',
    // Agence de test : un an d'accès, pas les 31 jours d'un nouveau client.
    untilAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  }).returning()
  if (!tenant) throw new Error('Échec de création du tenant')

  const [contact] = await db.insert(contacts).values({
    tenantId: tenant.id,
    waId: '33651228414',
    phone: '+33 6 51 22 84 14',
    fullName: 'Mamadou Diallo',
    declaredCity: 'Paris',
    kind: 'prospect',
  }).returning()
  if (!contact) throw new Error('Échec de création du contact')

  const [lead] = await db.insert(leads).values({
    tenantId: tenant.id,
    contactId: contact.id,
    intent: 'purchase',
    propertyType: 'villa',
    zone: 'Ngor',
    budgetAmount: 290_000_000,
    budgetCurrency: 'XOF',
    timeline: 'six_months',
    notes: '4 chambres, vue mer souhaitée',
  }).returning()
  if (!lead) throw new Error('Échec de création du lead')

  /* Fil réel, repris mot pour mot de docs/maquette-dashboard.html (l1) —
   * c'est le même échange que celui qui apparaît dans les captures. */
  await insertThread({
    tenantId: tenant.id,
    contactId: contact.id,
    profile: 'sales',
    base: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    lines: [
      { dir: 'in', atMinutes: 0, text: "Bonjour, je suis tombé sur l'annonce de la villa à Ngor. Elle est toujours disponible ?" },
      { dir: 'out', atMinutes: 0.63, text: "Bonjour. Coumba, assistante de Résidences Atlantique — je suis un agent automatisé, un conseiller prend le relais dès que c'est utile. Oui, la Villa Ngor Corniche est toujours disponible. Pour vous orienter au mieux : c'est pour un achat, et dans quel délai ?" },
      { dir: 'in', atMinutes: 3, text: "Achat oui. Je rentre au pays en décembre, c'est pour la famille." },
      { dir: 'out', atMinutes: 3.5, text: 'Noté. Combien de chambres vous faut-il au minimum ?' },
      { dir: 'in', atMinutes: 4, text: 'Il me faut de la place dehors pour les enfants.' },
      { dir: 'out', atMinutes: 5, text: "La villa fait 320 m², de plain-pied : 6 pièces dont 4 chambres et 3 salles d'eau, avec jardin, piscine, garage et groupe électrogène. Elle est à 285 000 000 FCFA. Est-ce que cet ordre de prix correspond à ce que vous aviez prévu ?" },
      { dir: 'in', atMinutes: 8, text: 'Oui ça va, je suis autour de 290 maximum.' },
      { dir: 'out', atMinutes: 8.5, text: 'Parfait, c\'est dans votre fourchette. Voici la fiche complète avec les photos : residences-atlantique.sn/biens/villa-ngor-corniche' },
      { dir: 'in', atMinutes: 13, text: 'Merci. Elle est à combien de mètres de la plage exactement ?' },
      { dir: 'out', atMinutes: 13.5, text: "Je n'ai pas cette information dans la fiche, et je préfère ne pas vous donner un chiffre au hasard. Je la note pour le conseiller, qui vous confirmera la distance exacte." },
      { dir: 'in', atMinutes: 15, text: "D'accord, c'est noté. Il y a un groupe électrogène ? Avec les coupures c'est important pour moi." },
      { dir: 'out', atMinutes: 15.5, text: 'Oui, la villa en est équipée. Le gardiennage est également inclus.' },
      { dir: 'in', atMinutes: 17, text: "Très bien. Le problème c'est que je ne suis à Dakar qu'en décembre, je ne peux pas visiter avant." },
      { dir: 'out', atMinutes: 18, text: 'Nous faisons des visites en visio : un conseiller se déplace avec son téléphone et vous suivez en direct. C\'est possible en soirée pour s\'adapter à votre heure en France. Souhaitez-vous que je vous propose des créneaux ?' },
      { dir: 'in', atMinutes: 20, text: 'Oui volontiers. Plutôt en fin de semaine si possible.' },
      { dir: 'out', atMinutes: 20.5, text: "C'est transmis. Un conseiller vous proposera deux créneaux de fin de semaine dans la journée, et il aura la réponse sur la distance de la plage." },
    ],
  })

  /* Deux leads de plus pour que la page de liste ait de quoi montrer —
   * repris de docs/maquette-dashboard.html (l2, l3). */
  const [contact2] = await db.insert(contacts).values({
    tenantId: tenant.id,
    waId: '33784093327',
    phone: '+33 7 84 09 33 27',
    fullName: 'Sophie Bernard',
    declaredCity: 'Lyon',
    kind: 'prospect',
  }).returning()
  if (!contact2) throw new Error('Échec de création du contact 2')

  const [lead2] = await db.insert(leads).values({
    tenantId: tenant.id,
    contactId: contact2.id,
    intent: 'purchase',
    propertyType: 'villa',
    zone: 'Saly',
    budgetAmount: 120_000_000,
    budgetCurrency: 'XOF',
    timeline: 'later',
    notes: 'avec piscine, proche plage',
  }).returning()
  if (!lead2) throw new Error('Échec de création du lead 2')

  const [contact3] = await db.insert(contacts).values({
    tenantId: tenant.id,
    waId: '221776142805',
    phone: '+221 77 614 28 05',
    fullName: 'Aïssatou Fall',
    declaredCity: 'Dakar',
    kind: 'prospect',
  }).returning()
  if (!contact3) throw new Error('Échec de création du contact 3')

  const [lead3] = await db.insert(leads).values({
    tenantId: tenant.id,
    contactId: contact3.id,
    intent: 'rental',
    propertyType: 'apartment',
    zone: 'Mermoz',
    budgetAmount: 650_000,
    budgetCurrency: 'XOF',
    timeline: 'six_months',
    notes: 'F3 meublé, bail 6 mois',
  }).returning()
  if (!lead3) throw new Error('Échec de création du lead 3')

  const [tenantContact] = await db.insert(contacts).values({
    tenantId: tenant.id,
    waId: '221774812065',
    phone: '+221 77 481 20 65',
    fullName: 'Fatoumata Ndour',
    kind: 'tenant',
  }).returning()
  if (!tenantContact) throw new Error('Échec de création du contact locataire')

  /* Faits : logement utilisable, aucune coupure, pas de risque, mais la
   * situation s'aggrave → urgent. Recalcul manuel de computeUrgency()
   * (packages/agent/src/urgency.ts) : ce package ne peut pas être importé
   * ici, il dépend lui-même de @codaya/db. Si la logique de calcul change,
   * mettre ce commentaire et la valeur à jour. */
  const ticket1Base = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const [ticket] = await db.insert(tickets).values({
    tenantId: tenant.id,
    contactId: tenantContact.id,
    reference: '248',
    subjectAsDeclared: 'La villa blanche aux Almadies, celle avec le portail vert',
    nature: 'plumbing',
    status: 'open',
    habitable: 'yes',
    utilityCut: 'none',
    safetyRisk: false,
    worsening: true,
    urgency: 'urgent',
    urgencyReason: "situation qui s'aggrave",
    createdAt: ticket1Base,
  }).returning()
  if (!ticket) throw new Error('Échec de création du dossier')

  /* Fil réel, repris mot pour mot de docs/maquette-dashboard.html (d248). */
  await insertThread({
    tenantId: tenant.id,
    contactId: tenantContact.id,
    profile: 'property_manager',
    base: ticket1Base,
    lines: [
      { dir: 'in', atMinutes: 0, text: "Bonjour, j'ai une fuite sous l'évier de la cuisine, ça mouille tout le placard" },
      { dir: 'out', atMinutes: 0.63, text: 'Bonjour Fatoumata. Malick, agent automatisé de Résidences Atlantique. Je vais ouvrir un dossier. Vous êtes locataire de quel bien ?' },
      { dir: 'in', atMinutes: 2, text: 'La villa blanche aux Almadies, celle avec le portail vert' },
      { dir: 'out', atMinutes: 2.5, text: 'Merci. Depuis quand avez-vous constaté la fuite ?' },
      { dir: 'in', atMinutes: 3, text: "Ce matin en ouvrant le placard. Hier soir il n'y avait rien." },
      { dir: 'out', atMinutes: 3.5, text: "Pouvez-vous m'envoyer une photo du dessous de l'évier ? Ça permet au plombier de venir avec la bonne pièce." },
      { dir: 'in', atMinutes: 6, text: "Voilà, j'en ai pris deux" },
      { dir: 'out', atMinutes: 6.5, text: 'C\'est bien reçu. Trois questions rapides pour classer le dossier. Le logement reste-t-il utilisable normalement ?' },
      { dir: 'in', atMinutes: 7, text: "Oui oui, c'est juste le placard qui est trempé" },
      { dir: 'out', atMinutes: 7.5, text: "Avez-vous une coupure d'eau ou d'électricité ?" },
      { dir: 'in', atMinutes: 8, text: 'Non, rien de coupé' },
      { dir: 'out', atMinutes: 8.5, text: "Et est-ce que la situation s'aggrave en ce moment, ou est-elle stable ?" },
      { dir: 'in', atMinutes: 11, text: "Là ça coule plus vite qu'il y a une heure, j'ai mis une bassine" },
      { dir: 'out', atMinutes: 11.5, text: "Merci, c'est une information importante. En attendant l'intervention, vous pouvez fermer le robinet d'arrêt sous l'évier s'il y en a un, pour limiter les dégâts. Le dossier n° 248 est ouvert et remonté à l'agence comme urgent, parce que la fuite s'aggrave. Vous recevrez un message dès qu'un créneau d'intervention sera fixé." },
    ],
  })

  /* Un dossier résolu, pour que la section « Résolus » de la liste ait
   * quelque chose à montrer. */
  const [tenantContact2] = await db.insert(contacts).values({
    tenantId: tenant.id,
    waId: '221772249055',
    phone: '+221 77 224 90 55',
    fullName: 'Seynabou Thiam',
    kind: 'tenant',
  }).returning()
  if (!tenantContact2) throw new Error('Échec de création du contact locataire 2')

  const [ticket2] = await db.insert(tickets).values({
    tenantId: tenant.id,
    contactId: tenantContact2.id,
    reference: '241',
    subjectAsDeclared: 'Fann résidence, le 2A',
    nature: 'electricity',
    status: 'resolved',
    habitable: 'yes',
    utilityCut: 'none',
    safetyRisk: false,
    worsening: false,
    urgency: 'normal',
    urgencyReason: '',
    resolvedAt: new Date(),
  }).returning()
  if (!ticket2) throw new Error('Échec de création du dossier 2')

  /* Repris de docs/maquette-dashboard.html (bien b1) : Amadou a lu l'annonce
   * mais n'a pas trouvé la surface ni l'ameublement — il laisse vide et
   * flague plutôt que d'inventer. `furnished:'to_qualify'` ET
   * `fieldsToConfirm` portent la même information à deux niveaux : l'un dit
   * l'état (inconnu), l'autre pilote l'avertissement dans l'interface. */
  const [property] = await db.insert(properties).values({
    tenantId: tenant.id,
    reference: 'MRZ-F4-01',
    title: 'Appartement F4 à Mermoz, 1er étage',
    transaction: 'long_term_rental',
    type: 'apartment',
    typology: 'f4',
    city: 'Dakar',
    district: 'Mermoz',
    floor: '1er',
    rooms: 5,
    bedrooms: 3,
    bathrooms: 3,
    guestToilet: true,
    price: 1_200_000,
    rentPeriod: 'month',
    charges: 'excluded',
    furnished: 'to_qualify',
    availability: 'available',
    status: 'published',
    amenities: ['Cuisine équipée', 'Four', 'Lave-vaisselle', 'Lave-linge', 'Balcon', 'Garage'],
    services: ['Gardiennage', 'Wifi inclus', 'Ménage', 'Espaces communs'],
    notes: "Femme de ménage 3 fois par semaine. Terrasse commune aménagée sur le toit : salon d'été et barbecue.",
    listingUrl: 'https://www.expat-dakar.com/annonce/appartement-f4-mermoz',
    sourceUrl: 'https://www.expat-dakar.com/annonce/appartement-f4-mermoz',
    rawListing: "A Mermoz, au premier étage Appartement F4, composé d'un grand, lumineux salon ; 3 chambres, chambre principale avec toilettes internes, toilettes pour les 2 chambres… wc visiteurs, grande cuisine équipée : four, lave-vaisselle linge, lave-vaisselle. Grand balcon… Loyer longue durée : 1.200.000 hors charges. Femme de ménage 3 fois par semaine, wifi, gardiennage, garage.",
    source: 'url',
    fieldsToConfirm: ['areaSqm', 'furnished'],
  }).returning()
  if (!property) throw new Error('Échec de création du bien')

  /* Un deuxième bien — vente, publié, sans rien à confirmer — repris de
   * docs/maquette-dashboard.html (b2). */
  const [property2] = await db.insert(properties).values({
    tenantId: tenant.id,
    reference: 'NGR-V4-01',
    title: 'Villa Ngor Corniche',
    transaction: 'sale',
    type: 'villa',
    typology: 'f5',
    city: 'Dakar',
    district: 'Ngor',
    floor: 'Plain-pied',
    areaSqm: 320,
    rooms: 6,
    bedrooms: 4,
    bathrooms: 3,
    guestToilet: true,
    price: 285_000_000,
    rentPeriod: 'none',
    charges: 'none',
    furnished: 'unfurnished',
    availability: 'available',
    status: 'published',
    amenities: ['Piscine', 'Cuisine équipée', 'Climatisation', 'Jardin', 'Garage', 'Groupe électrogène'],
    services: ['Gardiennage'],
    listingUrl: 'https://residences-atlantique.sn/biens/villa-ngor-corniche',
    source: 'form',
    fieldsToConfirm: [],
  }).returning()
  if (!property2) throw new Error('Échec de création du bien 2')

  /* Deux demandes de visite — ce que Coumba a fait, pas des rendez-vous :
   * on ne sait pas si le lien a été utilisé. Voir §10 des spécifications. */
  const [visit1] = await db.insert(visitRequests).values({
    tenantId: tenant.id,
    leadId: lead.id,
    propertyId: property2.id,
    intent: 'purchase',
    mode: 'link_sent',
    bookingUrlSent: tenant.bookingUrlRental,
  }).returning()
  if (!visit1) throw new Error('Échec de création de la demande de visite 1')

  /* Pas de bien correspondant au catalogue actuel (Villa Saly pas encore
   * ajoutée) : propertyId reste vide plutôt que rattaché à tort. */
  const [visit2] = await db.insert(visitRequests).values({
    tenantId: tenant.id,
    leadId: lead2.id,
    propertyId: null,
    intent: 'purchase',
    mode: 'callback_announced',
    bookingUrlSent: null,
  }).returning()
  if (!visit2) throw new Error('Échec de création de la demande de visite 2')

  console.log('Tenant créé  :', tenant.id, `(${tenant.name})`)
  console.log('Contact créé :', contact.id)
  console.log('Leads créés  :', [lead.id, lead2.id, lead3.id].join(', '))
  console.log('Dossiers créés :', [ticket.id, ticket2.id].join(', '))
  console.log('Biens créés  :', [property.id, property2.id].join(', '))
  console.log('Visites créées :', [visit1.id, visit2.id].join(', '))
  console.log('\nAjoute dans .env :')
  console.log(`DEV_TENANT_ID=${tenant.id}`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
