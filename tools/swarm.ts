// https://transform.tools/json-to-typescript

export interface Root {
  meta: Meta;
  notifications: Notification[];
  response: Response;
}

export interface Meta {
  code: number;
  requestId: string;
}

export interface Notification {
  type: string;
  item: Item;
}

export interface Item {
  unreadCount: number;
}

export interface Response {
  checkins: Checkins;
}

export interface Checkins {
  count: number;
  items: Checkin[];
}

export interface Checkin {
  id: string;
  createdAt: number;
  type: string;
  canonicalUrl: string;
  canonicalPath: string;
  timeZoneOffset: number;
  venue: Venue;
  likes: Likes;
  like: boolean;
  sticker?: Sticker;
  isMayor: boolean;
  photos: Photos;
  posts: Posts;
  comments: Comments;
  source: Source2;
  event?: Event;
}

export interface Venue {
  id: string;
  name: string;
  contact: Contact;
  location: Location;
  canonicalUrl: string;
  canonicalPath: string;
  categories: Category[];
  verified: boolean;
  stats: Stats;
  url?: string;
  urlSig?: string;
  allowMenuUrlEdit?: boolean;
  beenHere: BeenHere;
  createdAt: number;
  hasMenu?: boolean;
  deliveryProviders?: DeliveryProvider[];
  delivery?: Delivery;
  menu?: Menu;
  storeId?: string;
  locked?: boolean;
  venuePage?: VenuePage;
  venueRatingBlacklisted?: boolean;
  reservations?: Reservations;
}

export interface Contact {
  phone?: string;
  formattedPhone?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  facebookName?: string;
  facebookUsername?: string;
}

export interface Location {
  address?: string;
  crossStreet?: string;
  lat: number;
  lng: number;
  labeledLatLngs?: LabeledLatLng[];
  postalCode?: string;
  cc: string;
  city?: string;
  state?: string;
  country: string;
  contextLine: string;
  contextGeoId: number;
  formattedAddress: string[];
  neighborhood?: string;
}

export interface LabeledLatLng {
  label: string;
  lat: number;
  lng: number;
}

export interface Category {
  id: string;
  name: string;
  pluralName: string;
  shortName: string;
  icon: Icon;
  mapIcon: string;
  primary: boolean;
}

export interface Icon {
  prefix: string;
  mapPrefix: string;
  suffix: string;
}

export interface Stats {
  tipCount: number;
  usersCount: number;
  checkinsCount: number;
}

export interface BeenHere {
  lastCheckinExpiredAt: number;
}

export interface DeliveryProvider {
  id: string;
  url: string;
  provider: Provider;
}

export interface Provider {
  name: string;
  icon: Icon2;
}

export interface Icon2 {
  prefix: string;
  sizes: number[];
  name: string;
}

export interface Delivery {
  id: string;
  url: string;
  provider: Provider2;
}

export interface Provider2 {
  name: string;
  icon: Icon3;
}

export interface Icon3 {
  prefix: string;
  sizes: number[];
  name: string;
}

export interface Menu {
  type: string;
  label: string;
  anchor: string;
  url: string;
  mobileUrl: string;
  canonicalPath: string;
  externalUrl?: string;
}

export interface VenuePage {
  id: string;
}

export interface Reservations {
  url: string;
  provider: string;
  id: string;
}

export interface Likes {
  count: number;
  groups: any[];
}

export interface Sticker {
  id: string;
  name: string;
  image: Image;
  stickerType: string;
  group: Group;
  pickerPosition: PickerPosition;
  teaseText?: string;
  unlockText: string;
  bonusText?: string;
  points?: number;
  bonusStatus?: string;
}

export interface Image {
  prefix: string;
  sizes: number[];
  name: string;
}

export interface Group {
  name: string;
  index: number;
}

export interface PickerPosition {
  page: number;
  index: number;
}

export interface Photos {
  count: number;
  items: Item3[];
  layout?: Layout;
}

export interface Item3 {
  id: string;
  createdAt: number;
  source: Source;
  prefix: string;
  suffix: string;
  width: number;
  height: number;
  user: User;
  visibility: string;
}

export interface Source {
  name: string;
  url: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  handle: string;
  privateProfile: boolean;
  gender: string;
  countryCode: string;
  relationship: string;
  canonicalUrl: string;
  canonicalPath: string;
  photo: Photo;
  isAnonymous: boolean;
}

export interface Photo {
  prefix: string;
  suffix: string;
}

export interface Layout {
  name: string;
}

export interface Posts {
  count: number;
  textCount: number;
}

export interface Comments {
  count: number;
}

export interface Source2 {
  name: string;
  url: string;
}

export interface Event {
  id: string;
  name: string;
  categories: Category2[];
}

export interface Category2 {
  id: string;
  name: string;
  pluralName: string;
  shortName: string;
  icon: Icon4;
  primary: boolean;
}

export interface Icon4 {
  prefix: string;
  mapPrefix: string;
  suffix: string;
}
