import { PromotionSlide } from '../types';

export const DEFAULT_PROMOTION_SLIDES: PromotionSlide[] = [
  {
    id: 'default-1',
    image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1200&auto=format&fit=crop',
    title: "Today's Menu",
    subtitle: 'Signature Dirty Coffee & Fresh Croissant',
    badge: '40% OFF',
    is_active: true
  },
  {
    id: 'default-2',
    image_url: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?q=80&w=1200&auto=format&fit=crop',
    title: 'Matcha Uji Special',
    subtitle: 'มัทฉะเกรดพิธีการเข้มข้น นมสดแท้ 100%',
    badge: 'เมนูแนะนำ',
    is_active: true
  },
  {
    id: 'default-3',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
    title: 'Happy Hour 14:00 - 17:00',
    subtitle: 'ซื้อเครื่องดื่มแก้วที่ 2 ลดทันที 30% ทุกวัน',
    badge: 'LIMITED TIME',
    is_active: true
  }
];

export function getActiveSlides(rawJson?: string): PromotionSlide[] {
  if (!rawJson) return DEFAULT_PROMOTION_SLIDES;
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const active = parsed.filter((s: PromotionSlide) => s.is_active !== false);
      return active.length > 0 ? active : DEFAULT_PROMOTION_SLIDES;
    }
  } catch (e) {
    console.error('Failed to parse promotion_slides', e);
  }
  return DEFAULT_PROMOTION_SLIDES;
}

