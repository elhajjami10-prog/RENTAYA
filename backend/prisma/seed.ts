/* Données de démonstration : utilisateurs, voitures dans les grandes villes du Maroc, assurances, aide. */
import { PrismaClient, type CarCategory, type Fuel, type Transmission } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const uploads = path.resolve(process.cwd(), 'uploads', 'seed');
fs.mkdirSync(uploads, { recursive: true });
for (const f of fs.readdirSync(path.join(here, 'seed-assets'))) fs.copyFileSync(path.join(here, 'seed-assets', f), path.join(uploads, f));
const img = (shape: string, color: string) => [0, 1, 2].map((b) => `${API}/uploads/seed/${shape}-${color}-${b}.jpg`);

const CITIES: Record<string, [number, number, string[]]> = {
  Casablanca: [33.5731, -7.5898, ['Maârif', 'Gauthier', 'Anfa', 'Sidi Maârouf', 'Ain Diab', 'Bourgogne']],
  Rabat: [34.0209, -6.8416, ['Agdal', 'Hay Riad', 'Souissi', 'Hassan']],
  Marrakech: [31.6295, -7.9811, ['Guéliz', 'Hivernage', 'Médina', 'Targa']],
  Tanger: [35.7595, -5.834, ['Malabata', 'Centre-ville', 'Marshan']],
  Agadir: [30.4278, -9.5981, ['Founty', 'Talborjt', 'Hay Mohammadi']],
  'Fès': [34.0181, -5.0078, ['Ville Nouvelle', 'Saiss', 'Narjiss']],
  'Meknès': [33.8935, -5.5473, ['Hamria', 'Marjane']],
  Oujda: [34.6814, -1.9086, ['Centre', 'Al Qods']],
  'Tétouan': [35.5785, -5.3684, ['Centre', 'Martil']],
  Essaouira: [31.5085, -9.7595, ['Médina', 'Diabat']],
  'Kénitra': [34.261, -6.5802, ['Centre', 'Bir Rami']],
  'El Jadida': [33.2316, -8.5007, ['Centre', 'Sidi Bouzid']],
};

type Spec = [string, string, number, CarCategory, Transmission, Fuel, number, string, string, number];
// make, model, year, category, transmission, fuel, seats, shape, color, price
const SPECS: Spec[] = [
  ['Dacia', 'Logan', 2022, 'BERLINE', 'MANUAL', 'DIESEL', 5, 'sedan', 'white', 250],
  ['Dacia', 'Sandero Stepway', 2023, 'COMPACTE', 'MANUAL', 'DIESEL', 5, 'hatch', 'orange', 280],
  ['Renault', 'Clio 5', 2023, 'CITADINE', 'MANUAL', 'ESSENCE', 5, 'hatch', 'red', 290],
  ['Peugeot', '208', 2022, 'CITADINE', 'AUTOMATIC', 'ESSENCE', 5, 'hatch', 'blue', 330],
  ['Hyundai', 'Accent', 2021, 'BERLINE', 'AUTOMATIC', 'ESSENCE', 5, 'sedan', 'silver', 320],
  ['Kia', 'Picanto', 2022, 'CITADINE', 'AUTOMATIC', 'ESSENCE', 4, 'hatch', 'red', 230],
  ['Toyota', 'Yaris Hybride', 2023, 'CITADINE', 'AUTOMATIC', 'HYBRIDE', 5, 'hatch', 'grey', 380],
  ['Volkswagen', 'Golf 8', 2022, 'COMPACTE', 'AUTOMATIC', 'DIESEL', 5, 'hatch', 'black', 450],
  ['Peugeot', '3008', 2023, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 'suv', 'grey', 600],
  ['Dacia', 'Duster', 2023, 'SUV', 'MANUAL', 'DIESEL', 5, 'suv', 'beige', 400],
  ['Hyundai', 'Tucson', 2022, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 'suv', 'white', 650],
  ['Toyota', 'Land Cruiser Prado', 2021, 'QUATRE_X_QUATRE', 'AUTOMATIC', 'DIESEL', 7, 'suv', 'white', 1200],
  ['Mercedes-Benz', 'Classe C', 2022, 'LUXE', 'AUTOMATIC', 'DIESEL', 5, 'sedan', 'black', 1100],
  ['Range Rover', 'Evoque', 2022, 'LUXE', 'AUTOMATIC', 'DIESEL', 5, 'suv', 'silver', 1400],
  ['Fiat', 'Doblo', 2021, 'UTILITAIRE', 'MANUAL', 'DIESEL', 2, 'suv', 'white', 380],
  ['Renault', 'Kangoo', 2022, 'UTILITAIRE', 'MANUAL', 'DIESEL', 5, 'suv', 'grey', 350],
  ['Skoda', 'Octavia', 2023, 'BERLINE', 'AUTOMATIC', 'DIESEL', 5, 'sedan', 'blue', 480],
  ['Kia', 'Sportage', 2023, 'SUV', 'AUTOMATIC', 'HYBRIDE', 5, 'suv', 'green', 700],
  ['Mercedes-Benz', 'Vito', 2021, 'MINIBUS', 'AUTOMATIC', 'DIESEL', 9, 'suv', 'black', 1000],
  ['Mini', 'Cooper Cabrio', 2022, 'CABRIOLET', 'AUTOMATIC', 'ESSENCE', 4, 'hatch', 'purple', 900],
  ['BMW', 'Série 3', 2021, 'BERLINE', 'AUTOMATIC', 'DIESEL', 5, 'sedan', 'grey', 950],
  ['Audi', 'A3 Sportback', 2022, 'COMPACTE', 'AUTOMATIC', 'ESSENCE', 5, 'hatch', 'white', 700],
  ['Seat', 'Ibiza', 2021, 'CITADINE', 'MANUAL', 'ESSENCE', 5, 'hatch', 'orange', 260],
  ['Dacia', 'Lodgy', 2021, 'MONOSPACE', 'MANUAL', 'DIESEL', 7, 'suv', 'silver', 420],
  ['Renault', 'Mégane Estate', 2021, 'BREAK', 'MANUAL', 'DIESEL', 5, 'sedan', 'grey', 400],
  ['Citroën', 'C3', 2023, 'CITADINE', 'MANUAL', 'ESSENCE', 5, 'hatch', 'purple', 270],
];

const FEATURES = ['AC', 'BLUETOOTH', 'GPS', 'USB', 'CARPLAY', 'REAR_CAMERA', 'PARKING_SENSORS', 'CRUISE_CONTROL', 'CHILD_SEAT', 'ROOF_RACK', 'SNOW_CHAINS', 'ISOFIX', 'KEYLESS', 'SUNROOF', 'BIKE_RACK'];

const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

async function main() {
  console.log('Nettoyage…');
  await prisma.$transaction([
    prisma.message.deleteMany(), prisma.conversation.deleteMany(), prisma.review.deleteMany(), prisma.inspection.deleteMany(),
    prisma.charge.deleteMany(), prisma.claim.deleteMany(), prisma.extension.deleteMany(), prisma.payment.deleteMany(),
    prisma.booking.deleteMany(), prisma.payout.deleteMany(), prisma.favorite.deleteMany(), prisma.carPhoto.deleteMany(),
    prisma.unavailability.deleteMany(), prisma.priceOverride.deleteMany(), prisma.document.deleteMany(), prisma.car.deleteMany(),
    prisma.notification.deleteMany(), prisma.walletTransaction.deleteMany(), prisma.savedSearch.deleteMany(), prisma.supportTicket.deleteMany(),
    prisma.user.deleteMany(), prisma.insurancePlan.deleteMany(), prisma.promoCode.deleteMany(), prisma.helpArticle.deleteMany(),
  ]);

  const hash = await bcrypt.hash('Rentaya2026!', 10);
  const base = { passwordHash: hash, emailVerified: true, phoneVerified: true, verificationStatus: 'VERIFIED' as const, licenseIssueDate: new Date('2012-06-01'), birthDate: new Date('1990-03-15'), licenseCountry: 'Maroc' };

  const admin = await prisma.user.create({ data: { ...base, email: 'admin@rentaya.ma', phone: '+212600000001', firstName: 'Admin', lastName: 'Rentaya', role: 'ADMIN', referralCode: 'ADMIN01', passwordHash: await bcrypt.hash('Admin2026!', 10) } });
  const owners = await Promise.all([
    prisma.user.create({ data: { ...base, email: 'youssef@rentaya.ma', phone: '+212661000001', firstName: 'Youssef', lastName: 'Benali', city: 'Casablanca', bio: 'Passionné d\'automobile, je loue mes voitures entretenues avec soin. Réponse rapide garantie !', referralCode: 'YOUSSEF1', rib: '011 780 0000123456789012 34', bankHolder: 'Youssef Benali', bankName: 'Attijariwafa bank', ratingAvg: 4.9, ratingCount: 37, responseTimeMin: 12 } }),
    prisma.user.create({ data: { ...base, email: 'atlas@rentaya.ma', phone: '+212522000002', firstName: 'Atlas', lastName: 'Cars', isPro: true, companyName: 'Atlas Cars SARL', companyIce: '001234567000089', city: 'Marrakech', bio: 'Agence de location professionnelle à Marrakech et Agadir. Livraison aéroport.', referralCode: 'ATLAS01', rib: '007 450 0000987654321098 76', bankHolder: 'Atlas Cars SARL', bankName: 'BMCE Bank of Africa', ratingAvg: 4.7, ratingCount: 112, responseTimeMin: 25 } }),
    prisma.user.create({ data: { ...base, email: 'khadija@rentaya.ma', phone: '+212662000003', firstName: 'Khadija', lastName: 'El Amrani', city: 'Rabat', bio: 'Je partage ma voiture quand je ne l\'utilise pas.', referralCode: 'KHADIJA1', ratingAvg: 4.8, ratingCount: 19, responseTimeMin: 40 } }),
    prisma.user.create({ data: { ...base, email: 'mehdi@rentaya.ma', phone: '+212663000004', firstName: 'Mehdi', lastName: 'Tazi', city: 'Tanger', referralCode: 'MEHDI01', ratingAvg: 4.6, ratingCount: 8, responseTimeMin: 90 } }),
  ]);
  const driver = await prisma.user.create({ data: { ...base, email: 'salma@rentaya.ma', phone: '+212664000005', firstName: 'Salma', lastName: 'Idrissi', city: 'Casablanca', referralCode: 'SALMA01', licenseNumber: 'AB123456', cinNumber: 'BE765432', walletBalance: 100 } });
  await prisma.user.create({ data: { ...base, verificationStatus: 'PENDING', email: 'amine@rentaya.ma', phone: '+212665000006', firstName: 'Amine', lastName: 'Chraibi', city: 'Fès', referralCode: 'AMINE01', referredById: driver.id } });

  console.log('Assurances…');
  const plans = await Promise.all([
    prisma.insurancePlan.create({ data: { code: 'ESSENTIEL', position: 0, pricePerDay: 0, franchise: 10000, nameFr: 'Essentielle', nameAr: 'الأساسية', nameEn: 'Essential',
      descriptionFr: 'Assurance tous risques incluse et assistance 24h/24. Franchise de 10 000 MAD en cas de sinistre responsable.',
      descriptionAr: 'تأمين شامل ومساعدة على مدار الساعة. مبلغ التحمل 10000 درهم في حالة حادث.',
      descriptionEn: 'Comprehensive insurance and 24/7 roadside assistance. 10,000 MAD deductible for at-fault damage.' } }),
    prisma.insurancePlan.create({ data: { code: 'CONFORT', position: 1, pricePerDay: 60, franchise: 4000, nameFr: 'Confort', nameAr: 'الراحة', nameEn: 'Comfort',
      descriptionFr: 'Franchise réduite à 4 000 MAD. Bris de glace et pneus couverts.',
      descriptionAr: 'مبلغ تحمل مخفض إلى 4000 درهم. تغطية الزجاج والإطارات.',
      descriptionEn: 'Deductible reduced to 4,000 MAD. Glass and tyres covered.' } }),
    prisma.insurancePlan.create({ data: { code: 'SERENITE', position: 2, pricePerDay: 110, franchise: 0, nameFr: 'Sérénité', nameAr: 'راحة البال', nameEn: 'Peace of mind',
      descriptionFr: 'Zéro franchise. Bris de glace, pneus, vol et véhicule de remplacement couverts.',
      descriptionAr: 'بدون مبلغ تحمل. تغطية الزجاج والإطارات والسرقة وسيارة بديلة.',
      descriptionEn: 'Zero deductible. Glass, tyres, theft and replacement vehicle covered.' } }),
  ]);

  console.log('Voitures…');
  const r = rnd(42);
  const cityNames = Object.keys(CITIES);
  const cars = [];
  for (let i = 0; i < 60; i++) {
    const s = SPECS[i % SPECS.length];
    const city = i < 18 ? 'Casablanca' : i < 26 ? 'Marrakech' : i < 33 ? 'Rabat' : cityNames[i % cityNames.length];
    const [lat, lng, districts] = CITIES[city];
    const owner = city === 'Marrakech' || city === 'Agadir' ? owners[1] : city === 'Rabat' ? owners[2] : city === 'Tanger' ? owners[3] : owners[i % 2 === 0 ? 0 : 1];
    const feats = FEATURES.filter(() => r() > 0.55);
    if (!feats.includes('AC')) feats.unshift('AC');
    const district = districts[i % districts.length];
    const instant = r() > 0.5;
    const car = await prisma.car.create({
      data: {
        ownerId: owner.id, make: s[0], model: s[1], year: s[2] - (i % 3 === 0 ? 1 : 0), category: s[3], transmission: s[4], fuel: s[5], seats: s[6],
        doors: s[3] === 'UTILITAIRE' && s[6] === 2 ? 3 : 5, odometerKm: 15000 + Math.round(r() * 90000), color: s[8],
        plate: `${10000 + i * 137}-${['أ', 'ب', 'د', 'هـ', 'و'][i % 5]}-${[1, 6, 26, 40, 33][i % 5]}`,
        title: `${s[0]} ${s[1]} — ${district}`,
        description: `${s[0]} ${s[1]} ${s[4] === 'AUTOMATIC' ? 'automatique' : 'manuelle'}, très bien entretenue et propre. Idéale pour ${s[6] >= 7 ? 'les familles et les groupes' : s[3] === 'UTILITAIRE' ? 'vos déménagements' : 'la ville comme pour les longs trajets'}. Rendez-vous possible à ${district}, ${city}.`,
        features: feats,
        address: `${10 + i} Rue ${['Ibn Sina', 'Al Massira', 'Mohammed V', 'Hassan II', 'Zerktouni', 'Abdelmoumen'][i % 6]}, ${district}`,
        city, district,
        latitude: lat + (r() - 0.5) * 0.08, longitude: lng + (r() - 0.5) * 0.08,
        pricePerDay: s[9] + Math.round((r() - 0.5) * 6) * 10,
        smartPricing: r() > 0.6,
        weeklyDiscount: [0, 10, 15, 20][i % 4], monthlyDiscount: [0, 20, 30, 35][i % 4],
        instantBooking: instant, minDays: s[3] === 'LUXE' ? 2 : 1, maxDays: 30,
        kmPerDay: s[3] === 'LUXE' ? 150 : 250, unlimitedKm: i % 7 === 0, extraKmPrice: s[3] === 'LUXE' ? 3 : 1.5,
        depositAmount: s[3] === 'LUXE' || s[3] === 'QUATRE_X_QUATRE' ? 10000 : 3000,
        minDriverAge: s[3] === 'LUXE' ? 25 : 21, minLicenseYears: s[3] === 'LUXE' ? 3 : 2,
        deliveryAvailable: owner.isPro || i % 3 === 0, deliveryPrice: owner.isPro ? 150 : 100, deliveryRadiusKm: 20, airportDelivery: owner.isPro,
        cancellationPolicy: owner.isPro ? 'MODERATE' : (['FLEXIBLE', 'MODERATE', 'STRICT'] as const)[i % 3],
        pickupInstructions: 'Rendez-vous devant la résidence, appelez-moi à votre arrivée.',
        status: 'ACTIVE', ratingAvg: Math.round((4.3 + r() * 0.7) * 10) / 10, ratingCount: Math.floor(r() * 40), tripsCount: Math.floor(r() * 60),
        photos: { create: img(s[7], s[8]).map((url, position) => ({ url, position })) },
      },
    });
    cars.push(car);
  }
  // une annonce en attente de modération
  await prisma.car.create({ data: { ownerId: owners[3].id, make: 'Hyundai', model: 'i10', year: 2020, category: 'CITADINE', transmission: 'MANUAL', fuel: 'ESSENCE', seats: 4, doors: 5, odometerKm: 60000, plate: '55555-ب-40', address: 'Bd Pasteur', city: 'Tanger', latitude: 35.77, longitude: -5.81, pricePerDay: 220, status: 'PENDING_REVIEW', features: ['AC'], photos: { create: img('hatch', 'silver').map((url, position) => ({ url, position })) } } });

  console.log('Réservations de démonstration…');
  const DAY = 86400000;
  const car0 = cars[0];
  const mk = async (o: { car: typeof car0; start: Date; days: number; status: 'COMPLETED' | 'CONFIRMED' | 'REQUESTED'; ref: string }) => {
    const basePrice = o.car.pricePerDay * o.days;
    const serviceFee = Math.max(20, Math.round(basePrice * 0.1));
    const insuranceFee = plans[1].pricePerDay * o.days;
    const commission = Math.round(basePrice * 0.2);
    return prisma.booking.create({
      data: {
        reference: o.ref, carId: o.car.id, driverId: driver.id, ownerId: o.car.ownerId,
        startAt: o.start, endAt: new Date(o.start.getTime() + o.days * DAY), status: o.status, days: o.days, pricePerDay: o.car.pricePerDay,
        basePrice, insurancePlanId: plans[1].id, insuranceFee, serviceFee, totalPrice: basePrice + serviceFee + insuranceFee,
        commission: commission + serviceFee + insuranceFee, ownerEarnings: basePrice - commission, depositAmount: o.car.depositAmount,
        kmIncluded: o.car.kmPerDay * o.days, extraKmPrice: o.car.extraKmPrice, paymentMethod: o.status === 'REQUESTED' ? null : 'CMI',
        paidAt: o.status === 'REQUESTED' ? null : new Date(o.start.getTime() - 5 * DAY), contractNumber: o.status === 'REQUESTED' ? null : 'CTR-' + o.ref,
        requestExpiresAt: o.status === 'REQUESTED' ? new Date(Date.now() + 20 * 3600_000) : null,
        message: o.status === 'REQUESTED' ? 'Bonjour, je souhaite louer votre voiture pour un week-end à Essaouira. Merci !' : null,
        conversation: { create: { userAId: driver.id, userBId: o.car.ownerId, carId: o.car.id, messages: { create: [
          { senderId: driver.id, body: 'Bonjour, la voiture est-elle disponible à ces dates ?' },
          { senderId: o.car.ownerId, body: 'Bonjour Salma, oui elle est disponible. Au plaisir !' },
        ] } } },
      },
    });
  };
  const past = await mk({ car: car0, start: new Date(Date.now() - 20 * DAY), days: 3, status: 'COMPLETED', ref: 'RTY-DEMO-001' });
  await prisma.payment.create({ data: { bookingId: past.id, userId: driver.id, type: 'BOOKING', method: 'CMI', status: 'PAID', amount: past.totalPrice, orderId: 'PAY-DEMO-001' } });
  await prisma.review.createMany({ data: [
    { bookingId: past.id, authorId: driver.id, targetUserId: car0.ownerId, carId: car0.id, role: 'DRIVER_TO_OWNER', rating: 5, cleanliness: 5, communication: 5, accuracy: 5, comment: 'Voiture impeccable et propriétaire très arrangeant. Je recommande !' },
    { bookingId: past.id, authorId: car0.ownerId, targetUserId: driver.id, role: 'OWNER_TO_DRIVER', rating: 5, punctuality: 5, cleanliness: 5, comment: 'Conductrice ponctuelle et soigneuse.' },
  ] });
  await prisma.booking.update({ where: { id: past.id }, data: { driverReviewed: true, ownerReviewed: true } });
  const upcoming = await mk({ car: cars[3], start: new Date(Date.now() + 3 * DAY), days: 4, status: 'CONFIRMED', ref: 'RTY-DEMO-002' });
  await prisma.payment.create({ data: { bookingId: upcoming.id, userId: driver.id, type: 'BOOKING', method: 'CMI', status: 'PAID', amount: upcoming.totalPrice, orderId: 'PAY-DEMO-002' } });
  await mk({ car: cars[2], start: new Date(Date.now() + 10 * DAY), days: 2, status: 'REQUESTED', ref: 'RTY-DEMO-003' });
  await prisma.favorite.createMany({ data: [cars[5], cars[12], cars[20]].map((c) => ({ userId: driver.id, carId: c.id })) });
  await prisma.user.update({ where: { id: driver.id }, data: { ratingAvg: 5, ratingCount: 1 } });

  console.log('Codes promo & aide…');
  await prisma.promoCode.createMany({ data: [
    { code: 'BIENVENUE', type: 'PERCENT', value: 10, maxDiscount: 200, firstBookingOnly: true },
    { code: 'RENTAYA50', type: 'FIXED', value: 50, minAmount: 300 },
  ] });

  const help: [string, string, Record<'fr' | 'ar' | 'en', [string, string]>][] = [
    ['comment-louer', 'Conducteurs', {
      fr: ['Comment louer une voiture ?', 'Recherchez une voiture par ville et par dates, choisissez votre formule d\'assurance puis envoyez une demande (ou réservez instantanément). Une fois la demande acceptée, payez par carte bancaire (CMI), Wafacash, Cash Plus ou virement. Le jour J, retrouvez le propriétaire et réalisez ensemble l\'état des lieux dans l\'application.'],
      ar: ['كيف أستأجر سيارة؟', 'ابحث عن سيارة حسب المدينة والتواريخ، اختر صيغة التأمين ثم أرسل طلبًا (أو احجز فورًا). بعد قبول الطلب، ادفع بالبطاقة البنكية (CMI) أو وفاكاش أو كاش بلوس أو تحويل بنكي. يوم الانطلاق، التقِ بالمالك وأنجزا معًا محضر حالة السيارة في التطبيق.'],
      en: ['How do I rent a car?', 'Search by city and dates, pick your insurance plan and send a request (or book instantly). Once accepted, pay by card (CMI), Wafacash, Cash Plus or bank transfer. On the day, meet the owner and complete the check-in together in the app.'] }],
    ['documents-requis', 'Conducteurs', {
      fr: ['Quels documents sont nécessaires ?', 'Une pièce d\'identité (CIN ou passeport), votre permis de conduire (recto/verso) et un selfie. Notre équipe vérifie votre profil sous 24 heures.'],
      ar: ['ما هي الوثائق المطلوبة؟', 'بطاقة التعريف الوطنية أو جواز السفر، رخصة السياقة (الوجهين) وصورة شخصية. يتحقق فريقنا من ملفك خلال 24 ساعة.'],
      en: ['Which documents are required?', 'An ID (national ID card or passport), your driving licence (front/back) and a selfie. Our team verifies your profile within 24 hours.'] }],
    ['assurance', 'Assurance', {
      fr: ['Comment fonctionne l\'assurance ?', 'Chaque location est couverte par une assurance tous risques et une assistance 24h/24. Vous pouvez réduire votre franchise en choisissant la formule Confort ou Sérénité.'],
      ar: ['كيف يعمل التأمين؟', 'كل كراء مغطى بتأمين شامل ومساعدة على مدار الساعة. يمكنك تخفيض مبلغ التحمل باختيار صيغة الراحة أو راحة البال.'],
      en: ['How does insurance work?', 'Every rental is covered by comprehensive insurance and 24/7 assistance. Reduce your deductible by choosing Comfort or Peace of mind.'] }],
    ['annulation', 'Réservations', {
      fr: ['Puis-je annuler ma location ?', 'Oui. Le remboursement dépend de la politique d\'annulation choisie par le propriétaire (flexible, modérée ou stricte), affichée sur l\'annonce. Si le propriétaire annule, vous êtes intégralement remboursé.'],
      ar: ['هل يمكنني إلغاء الكراء؟', 'نعم. يعتمد الاسترداد على سياسة الإلغاء التي يختارها المالك (مرنة، معتدلة أو صارمة). إذا ألغى المالك، يتم استرداد المبلغ كاملاً.'],
      en: ['Can I cancel my rental?', 'Yes. The refund depends on the owner\'s cancellation policy (flexible, moderate or strict) shown on the listing. If the owner cancels, you are fully refunded.'] }],
    ['proposer-voiture', 'Propriétaires', {
      fr: ['Comment proposer ma voiture ?', 'Depuis l\'onglet « Mes voitures », ajoutez votre véhicule en quelques minutes : modèle, photos, adresse, prix et disponibilités. Notre équipe valide l\'annonce, puis vous recevez des demandes. Vos gains sont virés sur votre RIB après chaque location.'],
      ar: ['كيف أعرض سيارتي؟', 'من تبويب «سياراتي»، أضف سيارتك في دقائق: الطراز، الصور، العنوان، السعر والتوفر. يتحقق فريقنا من الإعلان ثم تستقبل الطلبات. تُحوَّل أرباحك إلى حسابك البنكي بعد كل كراء.'],
      en: ['How do I list my car?', 'From the "My cars" tab, add your vehicle in minutes: model, photos, address, price and availability. Our team approves the listing, then you receive requests. Earnings are transferred to your bank account after each rental.'] }],
    ['etat-des-lieux', 'Pendant la location', {
      fr: ['Comment faire l\'état des lieux ?', 'Au départ et au retour, ouvrez la location dans l\'application, prenez au moins 4 photos du véhicule, indiquez le kilométrage et le niveau de carburant, notez les dommages éventuels puis signez tous les deux sur le téléphone.'],
      ar: ['كيف أنجز محضر حالة السيارة؟', 'عند الانطلاق والإرجاع، افتح الكراء في التطبيق، التقط 4 صور على الأقل، أدخل عدد الكيلومترات ومستوى الوقود، سجل الأضرار إن وجدت ثم وقّعا معًا على الهاتف.'],
      en: ['How do I do the check-in?', 'At pick-up and return, open the rental in the app, take at least 4 photos, enter mileage and fuel level, note any damage, then both sign on the phone.'] }],
    ['paiement', 'Paiement', {
      fr: ['Quels moyens de paiement sont acceptés ?', 'Carte bancaire marocaine ou internationale via la plateforme sécurisée CMI, Wafacash, Cash Plus et virement bancaire. Pour les paiements en agence ou par virement, envoyez la photo du reçu dans l\'application.'],
      ar: ['ما هي وسائل الأداء المقبولة؟', 'البطاقة البنكية المغربية أو الدولية عبر منصة CMI الآمنة، وفاكاش، كاش بلوس والتحويل البنكي. أرسل صورة الوصل في التطبيق.'],
      en: ['Which payment methods are accepted?', 'Moroccan or international cards via the secure CMI platform, Wafacash, Cash Plus and bank transfer. Upload the receipt in the app for cash or transfer payments.'] }],
    ['accident', 'Pendant la location', {
      fr: ['Que faire en cas d\'accident ou de panne ?', 'Mettez-vous en sécurité, appelez l\'assistance Rentaya 24h/24, remplissez un constat amiable si un tiers est impliqué et déclarez le sinistre dans l\'application sous 48 heures avec photos.'],
      ar: ['ماذا أفعل في حالة حادث أو عطل؟', 'ضع نفسك في أمان، اتصل بمساعدة رينتايا على مدار الساعة، املأ محضرًا وديًا إذا كان هناك طرف آخر وصرّح بالحادث في التطبيق خلال 48 ساعة مع الصور.'],
      en: ['What if I have an accident or breakdown?', 'Get to safety, call Rentaya 24/7 assistance, fill in an accident report if a third party is involved and report the claim in the app within 48 hours with photos.'] }],
  ];
  let pos = 0;
  for (const [slug, category, tr] of help) {
    for (const locale of ['fr', 'ar', 'en'] as const) {
      await prisma.helpArticle.create({ data: { slug, locale, category, title: tr[locale][0], body: tr[locale][1], position: pos } });
    }
    pos++;
  }
  console.log(`✔ Seed terminé : ${cars.length} voitures. Admin: ${admin.email} / Admin2026!  — Utilisateurs démo: salma@rentaya.ma, youssef@rentaya.ma (mot de passe Rentaya2026!)`);
}

main().finally(() => prisma.$disconnect());
