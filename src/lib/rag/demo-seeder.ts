import { prisma } from '@/lib/prisma'

const BUILDERS = [
  { builderName: 'Goyal & Co. / HN Safal', brandName: 'Goyal & Co. · HN Safal', deliveryScore: 23, reraScore: 14, qualityScore: 19, financialScore: 13, responsivenessScore: 12, totalTrustScore: 81, grade: 'A' },
  { builderName: 'Shaligram Group', brandName: 'Shaligram Group', deliveryScore: 21, reraScore: 15, qualityScore: 15, financialScore: 12, responsivenessScore: 10, totalTrustScore: 73, grade: 'BB' },
  { builderName: 'Vishwanath Builders', brandName: 'Vishwanath Builders', deliveryScore: 24, reraScore: 15, qualityScore: 19, financialScore: 12, responsivenessScore: 13, totalTrustScore: 83, grade: 'A' },
  { builderName: 'Venus Group', brandName: 'Sundaram Landscape LLP (Venus Group)', deliveryScore: 18, reraScore: 17, qualityScore: 13, financialScore: 11, responsivenessScore: 10, totalTrustScore: 69, grade: 'B' },
  { builderName: 'Dev Infinity Buildcon', brandName: 'Dev Infinity Buildcon', deliveryScore: 12, reraScore: 13, qualityScore: 16, financialScore: 9, responsivenessScore: 7, totalTrustScore: 57, grade: 'B' },
]

const LOCALITIES = [
  { name: 'Shela', yoyGrowthPct: 9.2, demandScore: 86, avgPricePerSqft: 5400 },
  { name: 'South Bopal', yoyGrowthPct: 8.5, demandScore: 82, avgPricePerSqft: 5700 },
  { name: 'Bopal', yoyGrowthPct: 6.8, demandScore: 78, avgPricePerSqft: 6200 },
  { name: 'Daskroi', yoyGrowthPct: 11.5, demandScore: 64, avgPricePerSqft: 4100 },
]

const INFRASTRUCTURE = [
  { name: 'Ahmedabad Metro Phase 2', type: 'metro', priceImpactPct: 18, sourceUrl: 'https://gujaratmetrorail.com' },
  { name: 'SP Ring Road', type: 'highway', priceImpactPct: 12, sourceUrl: 'https://www.audabopal.in' },
  { name: '200 Ft Ring Road (SG Highway extension)', type: 'highway', priceImpactPct: 9, sourceUrl: 'https://www.audabopal.in' },
  { name: 'Bopal BRTS Corridor', type: 'transit', priceImpactPct: 5, sourceUrl: 'https://www.ahmedabadbrts.org' },
]

const PROJECTS = [
  { projectName: 'Riviera Elite', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 28000000, maxPrice: 36000000, configurations: '4BHK Typical · 4BHK Duplex · 4BHK Triplex · 5BHK Typical · 5BHK Duplex · 5BHK Triplex', possessionDate: new Date('2023-06-30'), amenities: ['Cracknell-designed landscape', 'Clubhouse', 'Gym', 'Pool'], honestConcern: 'Only 2 units remaining. RERA possession June 2023 passed — OC/handover must be verified. 2 complaints (2019 + Nov 2025).', analystNote: 'Cracknell Dubai landscape. 4BHK Typical 1,990 sqft + Duplex 3,916 sqft + Triplex 4,820 sqft.', priceNote: 'Sold Out — 4BHK ₹2.80Cr, 5BHK ₹3.60Cr (Transfer)', decisionTag: 'Strong Buy' },
  { projectName: 'Riviera Majestica', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '4BHK Typical · 5BHK Typical · 5BHK Duplex · 5BHK Triplex', possessionDate: new Date('2027-12-31'), amenities: ['Library', 'Yoga Studio', 'Cafeteria', 'Kids Pool'], honestConcern: 'Possession Dec 2027 — 1.75 years away — amenities only 40% complete. 2 quarterly compliance gaps.', analystNote: 'Sky City Township — 104 acres. RWDI wind + Ducon + E-Cube concrete.', priceNote: 'Basic Rate ₹6,200/sqft', decisionTag: 'Strong Buy' },
  { projectName: 'Shaligram Pride', builderName: 'Shaligram Group', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '3BHK + 27 Shops', possessionDate: new Date('2026-03-31'), amenities: ['Clubhouse', 'Gym'], honestConcern: 'Possession March 2026 — tight. Smaller carpet 373-859 sqft. Only 43 units remaining.', analystNote: '100% construction complete — only ready/near-ready project in BuyerChat database. 74/117 units sold. 0% project loan + SBI escrow.', priceNote: 'Basic Rate ₹4,200/sqft', decisionTag: 'Strong Buy' },
  { projectName: 'Riviera Palacio', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '4BHK · 5BHK · 7BHK Penthouse', possessionDate: new Date('2029-12-31'), amenities: ['Spa & Salon', 'Pickle Ball Court', 'Luxury Home Theatre', 'Marble interiors'], honestConcern: 'VRV AC mandatory — buyer must budget Rs.8-15L extra. Construction only 38.78%. Dec 2029 possession.', analystNote: '37-floor landmark tower — tallest residential in this micro-market.', priceNote: 'Basic Rate ₹6,000/sqft', decisionTag: 'Strong Buy' },
  { projectName: 'Riviera Woods', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 28000000, maxPrice: 36000000, configurations: '4BHK · 5BHK Typical/Duplex/Triplex', possessionDate: new Date('2024-06-30'), amenities: ['Sky City Township amenities'], honestConcern: 'No escrow bank record. Possession June 2024 passed — OC status must be confirmed. Only 1 unit remaining.', analystNote: '85% construction + 100% amenities. Sky City Township integrated living.', priceNote: 'Sold Out — 4BHK ₹2.80Cr, 5BHK ₹3.60Cr (Transfer)', decisionTag: 'Strong Buy' },
  { projectName: 'Riviera Bliss', builderName: 'Goyal & Co. / HN Safal', microMarket: 'South Bopal', minPrice: 0, maxPrice: 0, configurations: '3BHK · 4BHK · 4BHK Penthouse · 5BHK Penthouse', possessionDate: new Date('2029-12-31'), amenities: ['Wall-hung WC', 'Premium fittings'], honestConcern: 'Dec 2029 possession — 3.75 years away. 7.06% project loan. 39% booking absorption — low.', analystNote: 'Goyal & Co. (250+ projects since 1971) + HN Safal (43M sqft). Premium 3BHK, 4BHK, 5BHK Penthouse.', priceNote: 'Basic Rate ₹5,700/sqft', decisionTag: 'Strong Buy' },
  { projectName: 'Vishwanath Sarathya West', builderName: 'Vishwanath Builders', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '3BHK + Shops + Offices', possessionDate: new Date('2026-12-31'), amenities: ['45+ amenities', 'Johnson fittings', 'Jaquar CP', 'Anchor Panasonic switches'], honestConcern: '186 residential units still available (28%). Single-owner proprietorship structure. Room dimensions not in brochure.', analystNote: 'Johnson + Simpolo + Jaquar + Anchor Panasonic + Polycab — 5 named brands. 45+ amenities. 34 years Gujarat experience + ET Industry Leader 2023.', priceNote: 'Basic Rate ₹4,000/sqft', decisionTag: 'Strong Buy' },
  { projectName: 'Sky Villa', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '5BHK Standalone Villa + Basement + Lift Duct', possessionDate: new Date('2024-03-31'), amenities: ['Private plots 457-558 sqm', 'Home Theatre 15x33ft'], honestConcern: 'Lift duct only — buyer installs at own cost (Rs.5-10L). RERA March 2024 passed — OC must be verified.', analystNote: 'Only 41 units — rarest project. Private plots 457-558 sqm. Perfect RERA compliance + ICICI escrow.', priceNote: 'Land ₹60,000/SqYd + Construction ₹30,000/SqYd', decisionTag: 'Strong Buy' },
  { projectName: 'Riviera Aspire', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '3BHK · 4BHK · 4BHK Penthouse · 5BHK Penthouse', possessionDate: new Date('2027-06-30'), amenities: ['Kids Pool', 'Yoga Terrace', 'Outdoor Gym'], honestConcern: '1 complaint Feb 2025. 5 quarterly compliance gaps. OC status must be confirmed.', analystNote: '85% construction + 100% amenities. 16 units available.', priceNote: 'Sold Out — 3BHK & 4BHK ₹5,800/sqft (Transfer)', decisionTag: 'Strong Buy' },
  { projectName: 'Riviera Springs', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '3BHK · 4BHK · 4BHK Penthouse · 5BHK Penthouse', possessionDate: new Date('2026-12-30'), amenities: ['Clubhouse', '100% amenities ready'], honestConcern: 'Only 3 units remaining. Dec 2026 OC timeline must be verified. 1 recent complaint (Oct 2025).', analystNote: '85% construction + 100% amenities. 3BHK from 1,410 sqft carpet — most accessible entry into Sky City.', priceNote: 'Sold Out — 3BHK ₹6,000/sqft (Transfer)', decisionTag: 'Strong Buy' },
  { projectName: 'Floris Villa', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 34000000, maxPrice: 34000000, configurations: '4BHK Row House + Basement', possessionDate: new Date('2019-03-31'), amenities: ['DURAVIT EWC', 'JAQUAR CP fittings'], honestConcern: 'RERA end date 2019 — 6+ years overdue — OC must be verified urgently.', analystNote: 'Only row house/villa product. DURAVIT EWC + JAQUAR CP. 100% construction complete.', priceNote: 'Sold Out — All Inclusive ₹3.40Cr (Transfer)', decisionTag: 'Buy w/ Cond' },
  { projectName: 'Arcus Villa', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 55000000, maxPrice: 55000000, configurations: '4BHK Twin Bungalow + Basement', possessionDate: new Date('2019-03-31'), amenities: ['DURAVIT', 'JAQUAR', '18x13ft drawing room'], honestConcern: 'Common amenities only 71.43%. RERA 2019 passed — OC must be verified. 1 complaint Jun 2020.', analystNote: 'Twin bungalow format — larger, more private than Floris.', priceNote: 'Sold Out — ₹5.50Cr (Transfer)', decisionTag: 'Buy w/ Cond' },
  { projectName: 'Vernis Villa', builderName: 'Goyal & Co. / HN Safal', microMarket: 'Shela', minPrice: 75000000, maxPrice: 75000000, configurations: '4BHK Independent Bungalow + Basement + Lift', possessionDate: new Date('2019-03-31'), amenities: ['Italian Marble', 'In-unit Lift', '15x31ft activity room'], honestConcern: 'RERA 2019 passed — OC critical. Common amenities 71.43%. No escrow bank record.', analystNote: 'Italian Marble in Living + Dining — only project with Italian Marble as standard.', priceNote: 'Sold Out — ₹7.50Cr (Transfer)', decisionTag: 'Buy w/ Cond' },
  { projectName: 'The Planet', builderName: 'Venus Group', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '3BHK Residential + Showrooms', possessionDate: new Date('2030-12-31'), amenities: ['Pickleball Court', '62-shop retail plaza'], honestConcern: 'Only 5-10% construction complete as of Jan 2026. Dec 2030 possession = 4.5 year wait.', analystNote: 'Pickleball Court — only project in SoBo/Shela with one. Dual road frontage. 62-shop retail plaza within compound.', priceNote: 'Basic Rate ₹4,000/sqft', decisionTag: 'Buy w/ Cond' },
  { projectName: 'Shaligram Prestige', builderName: 'Shaligram Group', microMarket: 'Shela', minPrice: 0, maxPrice: 0, configurations: '3BHK + 79 Retail Shops', possessionDate: new Date('2025-07-14'), amenities: ['Lake-adjacent', 'Pickleball', 'Badminton'], honestConcern: 'Possession July 2025 OVERDUE — construction only 4-6% as of Mar 2026. 443/568 units unsold.', analystNote: 'Natural lake immediately adjacent — rare differentiator. 0% project loan on Rs.345Cr.', priceNote: 'Regular ₹4,200/sqft · DP ₹3,600/sqft', decisionTag: 'Wait' },
  { projectName: 'The Galaxy', builderName: 'Dev Infinity Buildcon', microMarket: 'Daskroi', minPrice: 0, maxPrice: 0, configurations: '3BHK + Ground Floor Shops', possessionDate: new Date('2030-12-31'), amenities: ['Club O7 Road location'], honestConcern: '0 completed projects by Dev Infinity Buildcon. Not started as of RERA Oct 2025 — Dec 2030 is 5+ year wait.', analystNote: 'Club O7 Road address. Low project loan (2.4%). SBI escrow.', priceNote: 'Basic Rate ₹4,200/sqft', decisionTag: 'Wait' },
]

const LOCATION_DATA = [
  { category: 'park', name: 'Shaligram Oxygen Park', microMarket: 'South Bopal', notes: 'Opened Jan 2025' },
  { category: 'park', name: 'Shaligram Oxygen Park', microMarket: 'Shela', notes: 'Opened Jan 2025' },
  { category: 'park', name: 'Electrotherm Park', microMarket: 'South Bopal', notes: 'Opened Dec 2025, 11,600 sqmt' },
  { category: 'park', name: 'AUDA Sky City', microMarket: 'South Bopal', notes: null },
  { category: 'hospital', name: 'Krishna Shalby Hospital', microMarket: 'South Bopal', notes: '210-bed NABH accredited' },
  { category: 'hospital', name: 'Krishna Shalby Hospital', microMarket: 'Shela', notes: '210-bed NABH accredited' },
  { category: 'hospital', name: 'Saraswati Hospital', microMarket: 'South Bopal', notes: null },
  { category: 'hospital', name: 'Tej Hospital', microMarket: 'South Bopal', notes: null },
  { category: 'hospital', name: 'HCG Oncology', microMarket: 'South Bopal', notes: 'Oncology specialty' },
  { category: 'bank', name: 'HDFC Bank', microMarket: 'South Bopal', notes: null },
  { category: 'bank', name: 'ICICI Bank', microMarket: 'South Bopal', notes: null },
  { category: 'bank', name: 'SBI', microMarket: 'South Bopal', notes: null },
  { category: 'bank', name: 'Axis Bank', microMarket: 'South Bopal', notes: null },
  { category: 'bank', name: 'Kotak Bank', microMarket: 'South Bopal', notes: null },
  { category: 'school', name: 'Apollo International School', microMarket: 'South Bopal', notes: 'CBSE, KG-12' },
  { category: 'school', name: 'DPS Bopal', microMarket: 'Bopal', notes: 'CBSE, KG-12' },
  { category: 'school', name: 'Shanti Asiatic School', microMarket: 'Shela', notes: 'CBSE, 1-12, off 200 Ft Ring Road' },
  { category: 'school', name: 'Anant National University', microMarket: 'Shela', notes: null },
  { category: 'school', name: 'MICA', microMarket: 'Shela', notes: 'Management institute' },
  { category: 'mall', name: 'DMart Bopal', microMarket: 'Bopal', notes: null },
  { category: 'mall', name: 'TRP Mall', microMarket: 'South Bopal', notes: null },
  { category: 'mall', name: 'SoBo Centre', microMarket: 'South Bopal', notes: null },
  { category: 'mall', name: 'Palladium', microMarket: 'South Bopal', notes: null },
  { category: 'club', name: 'Gala Gymkhana', microMarket: 'South Bopal', notes: null },
  { category: 'club', name: 'Club O7', microMarket: 'Shela', notes: null },
  { category: 'club', name: 'Karnavati Club', microMarket: 'South Bopal', notes: null },
  { category: 'club', name: 'Rajpath Club', microMarket: 'South Bopal', notes: null },
  { category: 'transport', name: 'Bopal BRTS', microMarket: 'Bopal', notes: 'BRTS stop, every 8-12 min' },
  { category: 'transport', name: 'Bopal BRTS', microMarket: 'South Bopal', notes: 'BRTS stop, every 8-12 min' },
  { category: 'transport', name: 'Metro Bopal Station', microMarket: 'Bopal', notes: '~1.2km, 2027 expected' },
  { category: 'transport', name: 'Metro Bopal Station', microMarket: 'South Bopal', notes: '~1.2km, 2027 expected' },
]

export async function seedDemoData() {
  for (const b of BUILDERS) {
    await prisma.builder.upsert({ where: { builderName: b.builderName }, create: b, update: b })
  }
  for (const l of LOCALITIES) {
    await prisma.locality.upsert({ where: { name: l.name }, create: l, update: l })
  }
  for (const i of INFRASTRUCTURE) {
    await prisma.infrastructure.upsert({ where: { name: i.name }, create: i, update: i })
  }
  for (const p of PROJECTS) {
    const existing = await prisma.project.findFirst({ where: { projectName: p.projectName, builderName: p.builderName }, select: { id: true } })
    if (existing) await prisma.project.update({ where: { id: existing.id }, data: p })
    else await prisma.project.create({ data: p })
  }
  for (const ld of LOCATION_DATA) {
    await prisma.locationData.upsert({
      where: { category_name_microMarket: { category: ld.category, name: ld.name, microMarket: ld.microMarket } },
      create: ld,
      update: { notes: ld.notes },
    })
  }
  return { builders: BUILDERS.length, localities: LOCALITIES.length, infrastructure: INFRASTRUCTURE.length, projects: PROJECTS.length, locationData: LOCATION_DATA.length }
}
