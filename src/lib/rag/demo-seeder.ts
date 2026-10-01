import { prisma } from '@/lib/prisma'

// Synthetic demo corpus. Every builder, project, locality, amenity, point of
// interest, and source URL below is an invented placeholder. It exists to
// exercise retrieval (on-topic queries) and refusal (off-topic queries), not to
// describe any real company, project, or place.

const BUILDERS = [
  { builderName: 'Builder A', brandName: 'Builder A', deliveryScore: 23, reraScore: 14, qualityScore: 19, financialScore: 13, responsivenessScore: 12, totalTrustScore: 81, grade: 'A' },
  { builderName: 'Builder B', brandName: 'Builder B', deliveryScore: 21, reraScore: 15, qualityScore: 15, financialScore: 12, responsivenessScore: 10, totalTrustScore: 73, grade: 'BB' },
  { builderName: 'Builder C', brandName: 'Builder C', deliveryScore: 24, reraScore: 15, qualityScore: 19, financialScore: 12, responsivenessScore: 13, totalTrustScore: 83, grade: 'A' },
  { builderName: 'Builder D', brandName: 'Builder D', deliveryScore: 18, reraScore: 17, qualityScore: 13, financialScore: 11, responsivenessScore: 10, totalTrustScore: 69, grade: 'B' },
  { builderName: 'Builder E', brandName: 'Builder E', deliveryScore: 12, reraScore: 13, qualityScore: 16, financialScore: 9, responsivenessScore: 7, totalTrustScore: 57, grade: 'B' },
]

const LOCALITIES = [
  { name: 'North Ridge', yoyGrowthPct: 9.2, demandScore: 86, avgPricePerSqft: 5400 },
  { name: 'South Hollow', yoyGrowthPct: 8.5, demandScore: 82, avgPricePerSqft: 5700 },
  { name: 'East Banks', yoyGrowthPct: 6.8, demandScore: 78, avgPricePerSqft: 6200 },
  { name: 'West Vale', yoyGrowthPct: 11.5, demandScore: 64, avgPricePerSqft: 4100 },
]

const INFRASTRUCTURE = [
  { name: 'Metro Line 2', type: 'metro', priceImpactPct: 18, sourceUrl: 'https://example.com/metro' },
  { name: 'Ring Road North', type: 'highway', priceImpactPct: 12, sourceUrl: 'https://example.com/roads' },
  { name: 'Ring Road West', type: 'highway', priceImpactPct: 9, sourceUrl: 'https://example.com/roads' },
  { name: 'Rapid Transit Corridor', type: 'transit', priceImpactPct: 5, sourceUrl: 'https://example.com/transit' },
]

const PROJECTS = [
  { projectName: 'North Court', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 28000000, maxPrice: 36000000, configurations: '3BHK', possessionDate: new Date('2026-06-30'), amenities: ['Clubhouse', 'Gym', 'Pool'], honestConcern: 'Illustrative note: a small number of units remain; verify handover status before purchase.', analystNote: 'Illustrative analyst note for a sample township project.', priceNote: 'Sample all-inclusive band (resale).', decisionTag: 'Strong Buy' },
  { projectName: 'North Vista', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK - 4BHK', possessionDate: new Date('2027-12-31'), amenities: ['Library', 'Yoga Studio', 'Cafeteria', 'Kids Pool'], honestConcern: 'Illustrative note: possession is a few years out and amenities are partially complete.', analystNote: 'Large integrated township; placeholder analyst note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Strong Buy' },
  { projectName: 'North Gardens', builderName: 'Builder B', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK + Shops', possessionDate: new Date('2026-03-31'), amenities: ['Clubhouse', 'Gym'], honestConcern: 'Illustrative note: compact carpet areas; limited units remaining.', analystNote: 'Near-ready project in the sample corpus; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Strong Buy' },
  { projectName: 'North Heights', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '4BHK - 5BHK', possessionDate: new Date('2029-12-31'), amenities: ['Spa', 'Sports Court', 'Home Theatre'], honestConcern: 'Illustrative note: optional fit-outs add to budget; construction in early stages.', analystNote: 'Tall landmark tower in the sample corpus; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Strong Buy' },
  { projectName: 'North Woods', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 28000000, maxPrice: 36000000, configurations: '4BHK', possessionDate: new Date('2026-06-30'), amenities: ['Township amenities'], honestConcern: 'Illustrative note: confirm occupancy certificate; limited units remaining.', analystNote: 'Integrated township living; placeholder note.', priceNote: 'Sample all-inclusive band (resale).', decisionTag: 'Strong Buy' },
  { projectName: 'South Court', builderName: 'Builder A', microMarket: 'South Hollow', minPrice: 0, maxPrice: 0, configurations: '3BHK - 4BHK', possessionDate: new Date('2029-12-31'), amenities: ['Premium fittings'], honestConcern: 'Illustrative note: possession several years out; absorption is still building.', analystNote: 'Premium configurations; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Strong Buy' },
  { projectName: 'South Vista', builderName: 'Builder C', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK + Offices', possessionDate: new Date('2026-12-31'), amenities: ['45+ amenities', 'Named-brand fittings'], honestConcern: 'Illustrative note: a share of units is still available; confirm unit dimensions.', analystNote: 'Named-brand fit-outs; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Strong Buy' },
  { projectName: 'South Gardens', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '5BHK Villa', possessionDate: new Date('2027-03-31'), amenities: ['Private plots', 'Home Theatre'], honestConcern: 'Illustrative note: optional in-unit fit-outs are at buyer cost.', analystNote: 'Rare villa format; placeholder note.', priceNote: 'Land + construction band (sample).', decisionTag: 'Strong Buy' },
  { projectName: 'South Heights', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK - 4BHK', possessionDate: new Date('2027-06-30'), amenities: ['Kids Pool', 'Yoga Terrace', 'Outdoor Gym'], honestConcern: 'Illustrative note: confirm occupancy-certificate timeline.', analystNote: 'Mid-stage construction; placeholder note.', priceNote: 'Sample all-inclusive band (resale).', decisionTag: 'Strong Buy' },
  { projectName: 'East Court', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK', possessionDate: new Date('2026-12-30'), amenities: ['Clubhouse'], honestConcern: 'Illustrative note: few units remaining; confirm handover timeline.', analystNote: 'Accessible entry configuration; placeholder note.', priceNote: 'Sample all-inclusive band (resale).', decisionTag: 'Strong Buy' },
  { projectName: 'East Vista', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 34000000, maxPrice: 34000000, configurations: '4BHK Row House', possessionDate: new Date('2027-03-31'), amenities: ['Premium sanitaryware'], honestConcern: 'Illustrative note: confirm occupancy certificate; resale inventory only.', analystNote: 'Row-house format; placeholder note.', priceNote: 'Sample all-inclusive band (resale).', decisionTag: 'Buy w/ Cond' },
  { projectName: 'East Gardens', builderName: 'Builder A', microMarket: 'South Hollow', minPrice: 55000000, maxPrice: 55000000, configurations: '4BHK Twin Unit', possessionDate: new Date('2027-03-31'), amenities: ['Premium fittings'], honestConcern: 'Illustrative note: shared amenities partially complete; confirm occupancy certificate.', analystNote: 'Twin-unit format; placeholder note.', priceNote: 'Sample all-inclusive band (resale).', decisionTag: 'Buy w/ Cond' },
  { projectName: 'East Heights', builderName: 'Builder D', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK + Shops', possessionDate: new Date('2028-12-31'), amenities: ['Retail plaza'], honestConcern: 'Illustrative note: early construction stage; long possession horizon.', analystNote: 'Mixed-use with retail; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Buy w/ Cond' },
  { projectName: 'West Court', builderName: 'Builder B', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK + Retail', possessionDate: new Date('2026-07-31'), amenities: ['Lake-adjacent', 'Sports courts'], honestConcern: 'Illustrative note: possession timeline should be confirmed with the seller.', analystNote: 'Lake-adjacent differentiator; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Wait' },
  { projectName: 'West Vista', builderName: 'Builder E', microMarket: 'West Vale', minPrice: 0, maxPrice: 0, configurations: '3BHK', possessionDate: new Date('2030-12-31'), amenities: ['Sports court', 'Retail plaza'], honestConcern: 'Illustrative note: early construction stage; long possession horizon.', analystNote: 'Mixed-use with retail plaza; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Buy w/ Cond' },
  { projectName: 'West Gardens', builderName: 'Builder A', microMarket: 'North Ridge', minPrice: 0, maxPrice: 0, configurations: '3BHK + Shops', possessionDate: new Date('2029-10-31'), amenities: ['Ground-floor shops'], honestConcern: 'Illustrative note: project not yet started; long possession horizon.', analystNote: 'Mixed-use with ground-floor shops; placeholder note.', priceNote: 'Basic rate band (sample).', decisionTag: 'Wait' },
]

const LOCATION_DATA = [
  { category: 'park', name: 'Central Park', microMarket: 'North Ridge', notes: 'Opened recently' },
  { category: 'park', name: 'Riverside Park', microMarket: 'South Hollow', notes: 'Opened recently' },
  { category: 'park', name: 'Meadow Park', microMarket: 'North Ridge', notes: 'Large neighbourhood park' },
  { category: 'park', name: 'Civic Park', microMarket: 'South Hollow', notes: null },
  { category: 'hospital', name: 'North General Hospital', microMarket: 'South Hollow', notes: 'Multi-speciality' },
  { category: 'hospital', name: 'North General Hospital', microMarket: 'North Ridge', notes: 'Multi-speciality' },
  { category: 'hospital', name: 'Riverside Clinic', microMarket: 'South Hollow', notes: null },
  { category: 'hospital', name: 'Civic Hospital', microMarket: 'South Hollow', notes: null },
  { category: 'hospital', name: 'Specialty Care Centre', microMarket: 'South Hollow', notes: 'Specialty care' },
  { category: 'bank', name: 'City Bank', microMarket: 'South Hollow', notes: null },
  { category: 'bank', name: 'Union Bank', microMarket: 'South Hollow', notes: null },
  { category: 'bank', name: 'National Bank', microMarket: 'South Hollow', notes: null },
  { category: 'bank', name: 'Metro Bank', microMarket: 'South Hollow', notes: null },
  { category: 'bank', name: 'Community Bank', microMarket: 'South Hollow', notes: null },
  { category: 'school', name: 'North Public School', microMarket: 'South Hollow', notes: 'K-12' },
  { category: 'school', name: 'East Public School', microMarket: 'East Banks', notes: 'K-12' },
  { category: 'school', name: 'Ridge Public School', microMarket: 'North Ridge', notes: '1-12' },
  { category: 'school', name: 'Regional University', microMarket: 'North Ridge', notes: null },
  { category: 'school', name: 'Management Institute', microMarket: 'North Ridge', notes: 'Management institute' },
  { category: 'mall', name: 'Ridge Retail Market', microMarket: 'East Banks', notes: null },
  { category: 'mall', name: 'Central Mall', microMarket: 'South Hollow', notes: null },
  { category: 'mall', name: 'South Centre', microMarket: 'South Hollow', notes: null },
  { category: 'mall', name: 'Grand Plaza', microMarket: 'South Hollow', notes: null },
  { category: 'club', name: 'North Sports Club', microMarket: 'South Hollow', notes: null },
  { category: 'club', name: 'Ridge Club', microMarket: 'North Ridge', notes: null },
  { category: 'club', name: 'Civic Club', microMarket: 'South Hollow', notes: null },
  { category: 'club', name: 'Riverside Club', microMarket: 'South Hollow', notes: null },
  { category: 'transport', name: 'Rapid Transit Stop', microMarket: 'East Banks', notes: 'Stop, every 8-12 min' },
  { category: 'transport', name: 'Rapid Transit Stop', microMarket: 'South Hollow', notes: 'Stop, every 8-12 min' },
  { category: 'transport', name: 'Metro Ridge Station', microMarket: 'East Banks', notes: '~1.2km, expected soon' },
  { category: 'transport', name: 'Metro Ridge Station', microMarket: 'South Hollow', notes: '~1.2km, expected soon' },
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
