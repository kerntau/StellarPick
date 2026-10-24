import { Category, Product } from './models';

export interface CategoryMeta extends Category {
  en: string;
  description: string;
}

/** Static merchandising metadata for the 20 seeded StellarPick products. */
export const CATEGORIES: CategoryMeta[] = [
  { slug: 'all', name: '全部商品', en: 'ALL', icon: 'grid', count: 20, description: '厨房、家居、个护、数码、出行与食品，一次逛齐。' },
  { slug: 'kitchen', name: '厨房', en: 'KITCHEN', icon: 'utensils', count: 4, description: '锅具、餐具与咖啡器具，做饭和收拾都更顺手。' },
  { slug: 'home', name: '家居', en: 'HOME', icon: 'sofa', count: 4, description: '床品、香氛与收纳，让家安静下来。' },
  { slug: 'personal', name: '个护', en: 'PERSONAL', icon: 'droplet', count: 3, description: '温和清洁与口腔护理，日常消耗品也值得挑。' },
  { slug: 'digital', name: '数码', en: 'DIGITAL', icon: 'smartphone', count: 4, description: '充电、外设与桌面效率，少一点线，多一点专注。' },
  { slug: 'travel', name: '出行', en: 'TRAVEL', icon: 'briefcase', count: 3, description: '登机箱、晴雨伞与颈枕，路上也能舒服一点。' },
  { slug: 'food', name: '食品', en: 'FOOD', icon: 'apple', count: 2, description: '咖啡与坚果，办公室和家里的常备口粮。' },
];

interface ProductMeta {
  categoryId: string;
  categoryName: string;
  subtitle: string;
  rating: number;
  sales: number;
  specs: { name: string; value: string }[];
}

export const PRODUCT_META: Record<number, ProductMeta> = {
  1001: { categoryId: 'kitchen', categoryName: '厨房', subtitle: '少油不粘，轻到单手颠勺。', rating: 4.8, sales: 1860, specs: [{ name: '直径', value: '28cm' }, { name: '锅体', value: '铝合金不粘涂层' }, { name: '适用', value: '燃气灶 / 电磁炉' }] },
  1002: { categoryId: 'kitchen', categoryName: '厨房', subtitle: '高温釉下彩，微波炉洗碗机都安心。', rating: 4.7, sales: 940, specs: [{ name: '数量', value: '4 件套' }, { name: '材质', value: '高温陶瓷' }, { name: '适用', value: '微波炉 / 洗碗机' }] },
  1003: { categoryId: 'kitchen', categoryName: '厨房', subtitle: '316 内胆，12 小时保温。', rating: 4.9, sales: 2400, specs: [{ name: '容量', value: '500ml' }, { name: '内胆', value: '316 不锈钢' }, { name: '保温', value: '12 小时' }] },
  1004: { categoryId: 'kitchen', categoryName: '厨房', subtitle: '一壶一杯，三分钟入门手冲。', rating: 4.6, sales: 520, specs: [{ name: '容量', value: '600ml' }, { name: '材质', value: '高硼硅玻璃' }, { name: '包含', value: '分享壶 / 滤杯 / 量勺' }] },
  1005: { categoryId: 'home', categoryName: '家居', subtitle: '60 支长绒棉，越洗越软。', rating: 4.8, sales: 1320, specs: [{ name: '规格', value: '1.5m / 1.8m 床' }, { name: '材质', value: '60 支长绒棉' }, { name: '包含', value: '被套 / 床单 / 枕套 ×2' }] },
  1006: { categoryId: 'home', categoryName: '家居', subtitle: '雪松与佛手柑，燃烧 40 小时。', rating: 4.5, sales: 760, specs: [{ name: '香型', value: '雪松 / 佛手柑' }, { name: '净含量', value: '220g' }, { name: '燃烧时长', value: '约 40 小时' }] },
  1007: { categoryId: 'home', categoryName: '家居', subtitle: '不用时压扁收起，承重 30kg。', rating: 4.6, sales: 1980, specs: [{ name: '容量', value: '55L' }, { name: '承重', value: '30kg' }, { name: '材质', value: 'PP + 牛津布' }] },
  1008: { categoryId: 'home', categoryName: '家居', subtitle: '美利奴羊毛，亲肤不扎。', rating: 4.7, sales: 610, specs: [{ name: '尺寸', value: '130 × 180cm' }, { name: '材质', value: '美利奴羊毛' }, { name: '克重', value: '480g' }] },
  1009: { categoryId: 'personal', categoryName: '个护', subtitle: '温和清洁，洗后不紧绷。', rating: 4.6, sales: 1510, specs: [{ name: '净含量', value: '120g' }, { name: '表活', value: '氨基酸' }, { name: '适用肤质', value: '干性 / 敏感肌' }] },
  1010: { categoryId: 'personal', categoryName: '个护', subtitle: '乳木果油，洗手后也不干。', rating: 4.5, sales: 1680, specs: [{ name: '数量', value: '3 支装' }, { name: '净含量', value: '30ml × 3' }, { name: '香型', value: '无香' }] },
  1011: { categoryId: 'personal', categoryName: '个护', subtitle: '五档模式，续航 60 天。', rating: 4.7, sales: 890, specs: [{ name: '模式', value: '5 档' }, { name: '续航', value: '约 60 天' }, { name: '防水', value: 'IPX7' }] },
  1012: { categoryId: 'digital', categoryName: '数码', subtitle: '一个头，手机笔电都能充。', rating: 4.8, sales: 2140, specs: [{ name: '功率', value: '65W' }, { name: '接口', value: 'USB-C ×2 / USB-A' }, { name: '协议', value: 'PD / QC' }] },
  1013: { categoryId: 'digital', categoryName: '数码', subtitle: '12 小时续航，IPX7 防水。', rating: 4.4, sales: 1130, specs: [{ name: '续航', value: '12 小时' }, { name: '防水', value: 'IPX7' }, { name: '连接', value: '蓝牙 5.3' }] },
  1014: { categoryId: 'digital', categoryName: '数码', subtitle: '图书馆级静音，续航一年。', rating: 4.5, sales: 1730, specs: [{ name: '连接', value: '2.4G 无线' }, { name: '续航', value: '约 12 个月' }, { name: '按键', value: '静音微动' }] },
  1015: { categoryId: 'digital', categoryName: '数码', subtitle: '抬高视线，桌面更清爽。', rating: 4.6, sales: 640, specs: [{ name: '材质', value: '铝合金' }, { name: '承重', value: '10kg' }, { name: '适配', value: '17–32 英寸' }] },
  1016: { categoryId: 'travel', categoryName: '出行', subtitle: '五五分仓，能装进经济舱。', rating: 4.8, sales: 1420, specs: [{ name: '尺寸', value: '20 寸' }, { name: '材质', value: 'PC + ABS' }, { name: '锁具', value: 'TSA 密码锁' }] },
  1017: { categoryId: 'travel', categoryName: '出行', subtitle: '五折收纳，晴雨两用。', rating: 4.4, sales: 2050, specs: [{ name: '伞面', value: '碰击布' }, { name: '防晒', value: 'UPF50+' }, { name: '收纳', value: '五折' }] },
  1018: { categoryId: 'travel', categoryName: '出行', subtitle: '慢回弹支撑，长途不落枕。', rating: 4.5, sales: 780, specs: [{ name: '材质', value: '记忆棉' }, { name: '外套', value: '可拆洗' }, { name: '重量', value: '280g' }] },
  1019: { categoryId: 'food', categoryName: '食品', subtitle: '10 条装，冷水一冲就是冷萃。', rating: 4.7, sales: 960, specs: [{ name: '规格', value: '10 条 × 20ml' }, { name: '烘焙', value: '中深烘' }, { name: '保质期', value: '9 个月' }] },
  1020: { categoryId: 'food', categoryName: '食品', subtitle: '30 天独立小包，锁鲜不返潮。', rating: 4.6, sales: 1560, specs: [{ name: '规格', value: '30 包' }, { name: '内容', value: '每日混合坚果' }, { name: '保质期', value: '6 个月' }] },
};

const CATEGORY_BY_PRODUCT = new Map<number, string>(
  Object.entries(PRODUCT_META).map(([id, meta]) => [Number(id), meta.categoryId]),
);

export function categoryOf(productId: number): string {
  return CATEGORY_BY_PRODUCT.get(productId) ?? 'all';
}

export function enrichProduct(raw: any): Product {
  const id = Number(raw.id);
  const meta = PRODUCT_META[id];
  const imageFile = String(raw.image ?? 'sp-' + id + '.svg');
  const image = imageFile.startsWith('/') ? imageFile : '/assets/public/images/products/' + imageFile;
  return {
    id,
    title: String(raw.name ?? '商品'),
    subtitle: meta?.subtitle ?? String(raw.description ?? '').slice(0, 40),
    price: Number(raw.price ?? 0),
    // Juice Shop v20 products have no stock column; treat the catalog as in stock.
    stock: Number(raw.quantity ?? raw.stock ?? 100),
    image,
    images: [image],
    categoryId: meta?.categoryId ?? 'all',
    categoryName: meta?.categoryName ?? '全部商品',
    category: meta?.categoryId ?? 'all',
    rating: meta?.rating ?? 4.5,
    sales: meta?.sales ?? 0,
    specs: meta?.specs ?? [],
    description: String(raw.description ?? ''),
  };
}
