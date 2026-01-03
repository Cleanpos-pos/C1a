export type Page = 'home' | 'services' | 'booking' | 'contact' | 'back-office' | 'driver-portal' | 'track-order' | 'customer-portal';

export interface ServiceItem {
  title: string;
  price: string;
  description: string;
}

export interface Testimonial {
  name: string;
  text: string;
  rating: number;
}

export interface TimeSlot {
  id: string;
  day: string;
  label: string;
  active: boolean;
}

export interface CartItem {
  name: string;
  price: string;
  quantity: number;
  note?: string; // Added note field
}

export interface DeliveryOption {
  id: string;
  label: string;
  price: number;
  active: boolean;
}