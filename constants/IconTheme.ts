import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

/**
 * IconTheme - Unified icon set for the Sagana app.
 *
 * All icons MUST be rendered through `MaterialIcons` from
 * `@expo/vector-icons`. The mapping below gives every icon a
 * semantic name so components don't need to remember Material icon
 * strings and can swap icon families in one place if required.
 *
 * Usage:
 *   import { MaterialIcon, IconTheme } from "@/constants/IconTheme";
 *   <MaterialIcon name={IconTheme.back} size={24} color={colors.text} />
 *
 * Or, for convenience, use the `Icon` wrapper component below.
 */

// IconName is derived from IconTheme's keys (defined below).
// Any key added to the IconTheme object becomes a valid IconName automatically.
export type IconName = keyof typeof IconTheme;

/**
 * Semantic icon name -> MaterialIcons glyph mapping.
 * When migrating from Ionicons / Feather / etc., look up the equivalent
 * name from this map. Names follow Material Icons conventions
 * (https://fonts.google.com/icons?icon.set=Material+Icons).
 */
export const IconTheme = {
  // Navigation
  back: "arrow-back",
  arrowBack: "arrow-back",
  arrowForward: "arrow-forward",
  arrowUp: "arrow-upward",
  arrowDown: "arrow-downward",
  arrowLeft: "arrow-back",
  arrowRight: "arrow-forward",
  arrowDropDown: "arrow-drop-down",
  arrowDropUp: "arrow-drop-up",
  chevronRight: "chevron-right",
  chevronLeft: "chevron-left",
  chevronUp: "expand-less",
  chevronDown: "expand-more",
  expandMore: "expand-more",
  expandLess: "expand-less",
  menu: "menu",
  menuOpen: "menu-open",
  more: "more-horiz",
  moreVertical: "more-vert",
  fullscreen: "fullscreen",
  fullscreenExit: "fullscreen-exit",
  close: "close",

  // Actions
  check: "check",
  checkCircle: "check-circle",
  closeCircle: "cancel",
  add: "add",
  remove: "remove",
  edit: "edit",
  delete: "delete",
  trash: "delete",
  save: "save",
  search: "search",
  filter: "filter-list",
  sort: "sort",
  refresh: "refresh",
  sync: "sync",
  download: "download",
  upload: "upload",
  send: "send",
  share: "share",
  pencil: "edit",
  plus: "add",
  minus: "remove",
  login: "login",
  logout: "logout",
  logoutVariant: "logout",

  // People / Account
  user: "person",
  users: "group",
  people: "group",
  peopleCircle: "account-circle",
  profile: "person",
  shield: "shield",
  shieldCheck: "verified-user",
  shieldAccount: "admin-panel-settings",

  // Commerce
  cart: "shopping-cart",
  shoppingCart: "shopping-cart",
  shoppingBag: "shopping-bag",
  store: "store",
  storefront: "storefront",
  tag: "local-offer",
  label: "label",
  receipt: "receipt",
  attachMoney: "attach-money",
  money: "attach-money",
  cash: "payments",
  card: "credit-card",
  wallet: "account-balance-wallet",
  orders: "assignment",
  box: "inventory-2",

  // Logistics
  package: "inventory-2",
  truck: "local-shipping",
  delivery: "local-shipping",
  shipping: "local-shipping",

  // Lists
  list: "list",
  grid: "grid-view",
  checklist: "checklist",
  trayFull: "inbox",

  // Engagement
  heart: "favorite",
  favorite: "favorite",
  star: "star",
  starOutline: "star-outline",
  starHalf: "star-half",
  rating: "star",
  bell: "notifications",
  notification: "notifications",
  notificationOff: "notifications-off",
  bellOff: "notifications-off",
  chat: "chat",
  message: "message",
  phone: "phone",
  email: "email",
  mail: "mail",

  // Location
  location: "location-on",
  pin: "place",
  map: "map",
  mapMarker: "place",
  navigation: "navigation",
  compass: "explore",

  // Time / Date
  calendar: "calendar-today",
  event: "event",
  eventAvailable: "event-available",
  today: "today",
  schedule: "schedule",
  clock: "schedule",
  time: "access-time",

  // Media
  camera: "photo-camera",
  image: "image",
  photo: "photo-library",
  video: "videocam",
  mic: "mic",
  play: "play-arrow",
  pause: "pause",
  stop: "stop",
  volumeUp: "volume-up",
  volumeOff: "volume-off",
  volumeMute: "volume-mute",

  // Status
  info: "info",
  infoCircle: "info",
  warning: "warning",
  error: "error",
  success: "check-circle",
  help: "help",
  question: "help",
  pending: "hourglass-empty",
  pendingActions: "pending-actions",
  verified: "verified",

  // Security
  eye: "visibility",
  eyeOff: "visibility-off",
  lock: "lock",
  unlock: "lock-open",
  key: "vpn-key",

  // Analytics
  analytics: "analytics",
  chart: "bar-chart",
  stats: "insights",
  trending: "trending-up",

  // Agriculture / Nature (Sagana domain)
  leaf: "eco",
  leafOutline: "eco",
  tree: "park",
  flower: "local-florist",
  farm: "agriculture",
  agriculture: "agriculture",
  seed: "spa",
  sprout: "grass",
  contentCut: "content-cut",
  sun: "wb-sunny",
  moon: "nightlight-round",
  cloud: "cloud",
  rain: "umbrella",
  fire: "local-fire-department",
  water: "water-drop",
  settings: "settings",
  home: "home",

  // Extra semantic aliases for legacy / Ionicons / MaterialCommunityIcons
  // glyphs not covered above. Each maps a familiar name to a MaterialIcons
  // glyph so screens can use IconTheme.edit2 etc.
  sliders: "tune",
  edit2: "edit",
  accountOutline: "person-outline",
  storeOutline: "storefront",
  mapMarkerOutline: "place",
  phoneOutline: "phone",
  emailOutline: "email",
  cardAccountDetailsOutline: "badge",
  walletOutline: "account-balance-wallet",
  giftOutline: "card-giftcard",
  cashMultiple: "payments",
  ticketPercent: "local-offer",
  ticketPercentOutline: "local-offer",
  cameraOutline: "photo-camera",
  heartOutline: "favorite-border",
  alertCircle: "info",
  alertTriangle: "warning-amber",
  sproutOutline: "eco",
  filterOutline: "filter-list",
  bag: "shopping-bag",
  formatSize: "format-size",
  flash: "flash-on",
  flashOff: "flash-off",
  cloudOutline: "cloud",
  sunOutline: "wb-sunny",
  fireOutline: "local-fire-department",
  waterOutline: "water-drop",
  moonOutline: "nightlight-round",
  shieldCheckmark: "verified-user",
  shieldCheckmarkOutline: "verified-user",
  receiptOutline: "receipt-long",
  documentTextOutline: "description",
  cubeOutline: "view-in-ar",
  gridOutline: "grid-view",
  bookOutline: "menu-book",
  helpCircleOutline: "help",
  business: "business",
  businessOutline: "business",
  school: "school",
  schoolOutline: "school",
  language: "language",
  languageOutline: "language",
  attachMoneyOutline: "attach-money",
  pricetag: "local-offer",
  pricetagOutline: "local-offer",
  labelOutline: "label",
  shieldCheckOutline: "verified-user",
  twoWheeler: "two-wheeler",
  myLocation: "my-location",
  truckDelivery: "local-shipping",
  storefrontMenu: "storefront",
  tagHeart: "favorite",
  directionsBike: "directions-bike",
  swapHoriz: "swap-horiz",
  wallet2: "account-balance-wallet",
  homeWork: "home-work",
  horizontalRule: "remove",
  tune: "tune",
  editNote: "edit",
  phoneInTalk: "phone-in-talk",
  reportProblem: "report-problem",
  helpOutline: "help-outline",
  chatBubble: "chat-bubble",
  peopleOutline: "group",
  shoppingBasket: "shopping-basket",
  verifiedUser: "verified-user",
  placeOutlined: "place",
  borderColor: "border-color",
  logoutIcon: "logout",
  arrowBackIos: "arrow-back-ios",
  chevronRightOutlined: "chevron-right",
  infoCircleOutlined: "info",
  addCircle: "add-circle",
  done: "done",
  deleteSweep: "delete-sweep",
  removeCircle: "remove-circle",
  localShippingTruck: "local-shipping",
  shareLocation: "share-location",
  lockReset: "lock-reset",
  lockOpen: "lock-open",
  shoppingBasketOutlined: "shopping-basket",
  assignmentInd: "assignment-ind",
  editAttributes: "edit-attributes",
  moveToInbox: "move-to-inbox",
  rateReview: "rate-review",
  announcement: "campaign",
  dashboardOutlined: "dashboard",
  creditCardOutlined: "credit-card",
  groupOutlined: "group",
  settingsOutlined: "settings",
  storeMall: "store",
  campaign: "campaign",
  biotech: "biotech",
  savings: "savings",
  redeem: "redeem",
  shoppingCartOutlined: "shopping-cart",
  fastfood: "fastfood",
  celebration: "celebration",
  homeFilled: "home",
  spa: "spa",
  ecoRound: "eco",
  savingsOutlined: "savings",
  searchOff: "search-off",
  favoriteBorder: "favorite-border",
  personPin: "person-pin",
  placeFilled: "place",
  moveDown: "arrow-downward",
  moveUp: "arrow-upward",
  listAlt: "list-alt",
  personOutlineCircle: "account-circle",
  shieldPerson: "shield",
  warehouse: "warehouse",
  agricultureTractor: "agriculture",
  parkOutlined: "park",
  waterDropOutlined: "water-drop",
  volunteerActivism: "volunteer-activism",
  sms: "sms",
  headsetMic: "headset-mic",
  adminPanel: "admin-panel-settings",
  messageCircle: "chat",
  userPlus: "person-add",
  atSign: "alternate-email",
  userCheck: "person-add-alt",
  userX: "person-remove",
  clipboardCheckOutline: "assignment-turned-in",
  grass: "grass",
  sprayBottle: "sanitizer",
  truckDeliveryOutline: "local-shipping",
  waterCheck: "water-drop",
  ladybug: "bug-report",
  weatherRainy: "water-drop",
  whiteBalanceSunny: "wb-sunny",
  unfoldMoreHorizontal: "unfold-more",
  arrowTopRight: "trending-up",
  arrowBottomRight: "trending-down",
} as const;

// Re-export the MaterialIcons component so screens can import everything
// icon-related from a single file.
export { MaterialIcons };
export type IconComponentProps = React.ComponentProps<typeof MaterialIcons>;

/**
 * Glyph name accepted by `MaterialIcons`. MaterialIcons has a very wide
 * union of glyph names; the values in `IconTheme` are guaranteed to be
 * valid MaterialIcons glyphs, so we expose this alias for callers that
 * store the result of `IconTheme.X` and pass it to `<MaterialIcons name>`.
 */
export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
