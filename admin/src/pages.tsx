import React, { useState } from 'react';
import { api, dt, mad } from './api';
import { act, ask, Badge, Filters, Img, KV, Modal, notice, Table, useLoad } from './ui';

// ---------------- Tableau de bord ----------------
export function Dashboard() {
  const { data: s } = useLoad('/admin/stats');
  if (!s) return <p>Chargement…</p>;
  const max = Math.max(1, ...s.daily.map((d: any) => d.count));
  const cards: [string, React.ReactNode, string?][] = [
    ['Volume d\'affaires (30 j)', mad(s.gmv30)], ['Revenus Rentaya (30 j)', mad(s.revenue30)], ['Réservations (30 j)', s.bookings30],
    ['Utilisateurs', s.users], ['Voitures en ligne', s.cars], ['Annonces à valider', s.pendingCars, 'cars'], ['Profils à vérifier', s.pendingUsers, 'users'],
    ['Paiements à valider', s.awaitingPayments, 'payments'], ['Remboursements à faire', s.pendingRefunds, 'refunds'], ['Versements à faire', s.pendingPayouts, 'payouts'],
    ['Sinistres ouverts', s.openClaims, 'claims'], ['Frais contestés', s.contested, 'charges'], ['Tickets support', s.openTickets, 'tickets'],
  ];
  return (
    <>
      <h1>Tableau de bord</h1>
      <div className="cards">
        {cards.map(([l, n, link]) => (
          <a key={l} className="card" href={link ? `#${link}` : undefined} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="n">{n}</div><div className="l">{l}</div>
          </a>
        ))}
      </div>
      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Réservations par jour (30 j)</h3>
          <div className="chart">{s.daily.map((d: any) => <div key={d.day} title={`${new Date(d.day).toLocaleDateString('fr-FR')} : ${d.count}`} style={{ height: `${(d.count / max) * 100}%` }} />)}</div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Répartition</h3>
          {s.byStatus.map((x: any) => <KV key={x.status} k={x.status} v={x.count} />)}
          <h3>Voitures par ville</h3>
          {s.byCity.sort((a: any, b: any) => b.count - a.count).map((x: any) => <KV key={x.city} k={x.city} v={x.count} />)}
        </div>
      </div>
    </>
  );
}

// ---------------- Utilisateurs ----------------
export function Users() {
  const [search, setSearch] = useState('');
  const [verification, setVerification] = useState('PENDING');
  const { data, reload } = useLoad('/admin/users', { search, verification });
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <h1>Utilisateurs</h1>
      <div className="bar">
        <input placeholder="Nom, e-mail, téléphone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Filters value={verification} onChange={setVerification} options={['NONE', 'PENDING', 'VERIFIED', 'REJECTED']} placeholder="Toutes vérifications" />
      </div>
      <Table rows={data?.items || []} onRow={(u: any) => setSel(u.id)} cols={[
        ['Nom', (u: any) => `${u.firstName} ${u.lastName}`], ['E-mail', (u: any) => u.email], ['Téléphone', (u: any) => u.phone || '—'],
        ['Vérification', (u: any) => <Badge v={u.verificationStatus} />], ['Type', (u: any) => (u.role === 'ADMIN' ? 'Admin' : u.isPro ? 'Pro' : 'Particulier')],
        ['Voitures', (u: any) => u._count.cars], ['Locations', (u: any) => u._count.bookingsAsDriver], ['Statut', (u: any) => (u.suspended ? <Badge v="SUSPENDU" /> : 'Actif')],
        ['Inscrit', (u: any) => dt(u.createdAt)],
      ]} />
      {sel ? <UserDetail id={sel} onClose={() => { setSel(null); reload(); }} /> : null}
    </>
  );
}

function UserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: u, reload } = useLoad(`/admin/users/${id}`);
  const [note, setNote] = useState('');
  if (!u) return null;
  const verify = (status: string) => act(() => api(`/admin/users/${id}/verification`, { body: { status, note: note || undefined } }), reload);
  return (
    <Modal title={`${u.firstName} ${u.lastName}`} onClose={onClose}>
      <KV k="E-mail" v={u.email} /><KV k="Téléphone" v={`${u.phone || '—'} ${u.phoneVerified ? '✓' : ''}`} />
      <KV k="Naissance" v={u.birthDate ? new Date(u.birthDate).toLocaleDateString('fr-FR') : '—'} /><KV k="CIN" v={u.cinNumber || '—'} />
      <KV k="Permis" v={`${u.licenseNumber || '—'} (depuis ${u.licenseIssueDate ? new Date(u.licenseIssueDate).toLocaleDateString('fr-FR') : '—'})`} />
      <KV k="Pro" v={u.isPro ? `${u.companyName} — ICE ${u.companyIce}` : 'Non'} /><KV k="RIB" v={u.rib ? `${u.bankHolder} — ${u.bankName} — ${u.rib}` : '—'} />
      <KV k="Crédit" v={mad(u.walletBalance)} /><KV k="Note" v={`${u.ratingAvg.toFixed(1)} (${u.ratingCount})`} /><KV k="Vérification" v={<Badge v={u.verificationStatus} />} />
      <h3>Documents</h3>
      <div className="row">{u.documents.map((d: any) => <div key={d.id}><Img src={d.url} /><div style={{ fontSize: 12 }}>{d.type}</div></div>)}</div>
      {!u.documents.length ? <p>Aucun document.</p> : null}
      <label>Motif (en cas de refus)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={() => verify('VERIFIED')}>Valider le profil</button>
        <button className="danger" onClick={() => verify('REJECTED')}>Refuser</button>
        <button className="secondary" onClick={() => act(() => api(`/admin/users/${id}`, { method: 'PATCH', body: { suspended: !u.suspended } }), reload, u.suspended ? undefined : 'Suspendre ce compte ?')}>{u.suspended ? 'Réactiver' : 'Suspendre'}</button>
        <button className="secondary" onClick={async () => { const a = await ask('Montant à créditer (négatif pour débiter), en MAD'); const n = await ask('Motif'); if (a && n) act(() => api(`/admin/users/${id}/wallet`, { body: { amount: Number(a), note: n } }), reload); }}>Ajuster le crédit</button>
      </div>
      <h3>Voitures</h3>
      {u.cars.map((c: any) => <KV key={c.id} k={`${c.make} ${c.model} (${c.plate})`} v={<Badge v={c.status} />} />)}
      <h3>Locations (conducteur)</h3>
      {u.bookingsAsDriver.map((b: any) => <KV key={b.id} k={`${b.reference} — ${dt(b.startAt)}`} v={<Badge v={b.status} />} />)}
      <h3>Locations (propriétaire)</h3>
      {u.bookingsAsOwner.map((b: any) => <KV key={b.id} k={`${b.reference} — ${dt(b.startAt)}`} v={<Badge v={b.status} />} />)}
    </Modal>
  );
}

// ---------------- Annonces ----------------
export function Cars() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const { data, reload } = useLoad('/admin/cars', { status, search });
  const [sel, setSel] = useState<any>(null);
  return (
    <>
      <h1>Annonces</h1>
      <div className="bar">
        <input placeholder="Marque, modèle, immatriculation" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Filters value={status} onChange={setStatus} options={['PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED', 'ARCHIVED']} />
      </div>
      <Table rows={data?.items || []} onRow={setSel} cols={[
        ['Photo', (c: any) => (c.photos[0] ? <img className="thumb" style={{ width: 70, height: 48, margin: 0 }} src={c.photos[0].url} /> : '—')],
        ['Véhicule', (c: any) => `${c.make} ${c.model} ${c.year}`], ['Immat.', (c: any) => c.plate], ['Ville', (c: any) => c.city],
        ['Prix/j', (c: any) => mad(c.pricePerDay)], ['Propriétaire', (c: any) => `${c.owner.firstName} ${c.owner.lastName}`], ['Docs', (c: any) => c.documents.length],
        ['Statut', (c: any) => <Badge v={c.status} />], ['Créée', (c: any) => dt(c.createdAt)],
      ]} />
      {sel ? (
        <Modal title={`${sel.make} ${sel.model} ${sel.year}`} onClose={() => setSel(null)}>
          <div className="row">{sel.photos.map((p: any) => <Img key={p.id} src={p.url} />)}</div>
          <KV k="Immatriculation" v={sel.plate} /><KV k="Catégorie" v={sel.category} /><KV k="Boîte / carburant" v={`${sel.transmission} / ${sel.fuel}`} />
          <KV k="Kilométrage" v={`${sel.odometerKm} km`} /><KV k="Adresse" v={`${sel.address}, ${sel.city}`} /><KV k="Prix" v={mad(sel.pricePerDay)} />
          <KV k="Caution" v={mad(sel.depositAmount)} /><KV k="Réservation instantanée" v={sel.instantBooking ? 'Oui' : 'Non'} />
          <KV k="Propriétaire" v={`${sel.owner.firstName} ${sel.owner.lastName} — ${sel.owner.email} — ${sel.owner.verificationStatus}`} />
          <p>{sel.description}</p>
          <h3>Documents du véhicule</h3>
          <div className="row">{sel.documents.map((d: any) => <div key={d.id}><Img src={d.url} /><div style={{ fontSize: 12 }}>{d.type}</div></div>)}</div>
          {!sel.documents.length ? <p>Aucun document fourni.</p> : null}
          <div className="row" style={{ marginTop: 14 }}>
            <button onClick={() => act(() => api(`/admin/cars/${sel.id}/review`, { body: { status: 'ACTIVE' } }), () => { setSel(null); reload(); })}>Publier</button>
            <button className="danger" onClick={async () => { const reason = await ask('Motif du refus (envoyé au propriétaire)'); if (reason) act(() => api(`/admin/cars/${sel.id}/review`, { body: { status: 'REJECTED', reason } }), () => { setSel(null); reload(); }); }}>Refuser</button>
            <button className="secondary" onClick={() => act(() => api(`/admin/cars/${sel.id}/review`, { body: { status: 'PAUSED' } }), () => { setSel(null); reload(); })}>Mettre en pause</button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

// ---------------- Réservations ----------------
export function Bookings() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data, reload } = useLoad('/admin/bookings', { status, search });
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <h1>Réservations</h1>
      <div className="bar">
        <input placeholder="Référence" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Filters value={status} onChange={setStatus} options={['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_ADMIN']} />
      </div>
      <Table rows={data?.items || []} onRow={(b: any) => setSel(b.id)} cols={[
        ['Réf.', (b: any) => b.reference], ['Véhicule', (b: any) => `${b.car.make} ${b.car.model}`], ['Conducteur', (b: any) => `${b.driver.firstName} ${b.driver.lastName}`],
        ['Propriétaire', (b: any) => `${b.owner.firstName} ${b.owner.lastName}`], ['Du', (b: any) => dt(b.startAt)], ['Au', (b: any) => dt(b.endAt)],
        ['Total', (b: any) => mad(b.totalPrice)], ['Commission', (b: any) => mad(b.commission)], ['Paiement', (b: any) => b.paymentMethod || '—'], ['Statut', (b: any) => <Badge v={b.status} />],
      ]} />
      {sel ? <BookingDetail id={sel} onClose={() => { setSel(null); reload(); }} /> : null}
    </>
  );
}

function BookingDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: b, reload } = useLoad(`/admin/bookings/${id}`);
  if (!b) return null;
  return (
    <Modal title={`Réservation ${b.reference}`} onClose={onClose}>
      <KV k="Statut" v={<Badge v={b.status} />} /><KV k="Véhicule" v={`${b.car.make} ${b.car.model} — ${b.car.plate}`} />
      <KV k="Conducteur" v={`${b.driver.firstName} ${b.driver.lastName} — ${b.driver.phone || ''} — ${b.driver.email}`} />
      <KV k="Propriétaire" v={`${b.owner.firstName} ${b.owner.lastName} — ${b.owner.phone || ''} — ${b.owner.email}`} />
      <KV k="Période" v={`${dt(b.startAt)} → ${dt(b.endAt)} (${b.days} j)`} /><KV k="Assurance" v={b.insurancePlan?.nameFr || '—'} />
      <h3>Prix</h3>
      <KV k="Location" v={mad(b.basePrice)} /><KV k="Réduction" v={mad(b.discountAmount)} /><KV k="Livraison" v={mad(b.deliveryFee)} /><KV k="Assurance" v={mad(b.insuranceFee)} />
      <KV k="Frais de service" v={mad(b.serviceFee)} /><KV k="Promo" v={`${b.promoCode || '—'} ${mad(b.promoDiscount)}`} /><KV k="Crédit utilisé" v={mad(b.walletUsed)} />
      <KV k="Total payé" v={mad(b.totalPrice)} /><KV k="Revenus propriétaire" v={mad(b.ownerEarnings)} /><KV k="Commission Rentaya" v={mad(b.commission)} />
      <KV k="Remboursé" v={mad(b.refundAmount)} /><KV k="Pénalité propriétaire" v={mad(b.ownerPenalty)} />
      <h3>Paiements</h3>
      {b.payments.map((p: any) => <KV key={p.id} k={`${p.type} — ${p.method} — ${p.orderId}`} v={<>{mad(p.amount)} <Badge v={p.status} /></>} />)}
      <h3>États des lieux</h3>
      {b.inspections.map((i: any) => (
        <div key={i.id}>
          <KV k={i.type} v={`${i.odometerKm} km — carburant ${i.fuelLevel}/8 — ${dt(i.createdAt)}`} />
          <div className="row">{i.photos.map((u: string) => <Img key={u} src={u} />)}</div>
          {(i.damages as any[]).map((d, k) => <div key={k}>• {d.zone} : {d.description}</div>)}
          <div className="row"><img src={i.driverSignature} style={{ height: 60 }} /><img src={i.ownerSignature} style={{ height: 60 }} /></div>
        </div>
      ))}
      <h3>Frais, prolongations, sinistres</h3>
      {b.charges.map((c: any) => <KV key={c.id} k={`${c.type} — ${c.description}`} v={<>{mad(c.amount)} <Badge v={c.status} /></>} />)}
      {b.extensions.map((e: any) => <KV key={e.id} k={`Prolongation → ${dt(e.newEndAt)}`} v={<>{mad(e.extraPrice)} <Badge v={e.status} /></>} />)}
      {b.claims.map((c: any) => <KV key={c.id} k={`Sinistre : ${c.description.slice(0, 60)}`} v={<Badge v={c.status} />} />)}
      <h3>Messages</h3>
      {b.conversation?.messages.map((m: any) => <div key={m.id} className={`msg ${m.system ? 'sys' : ''}`}><b>{m.system ? 'Système' : m.senderId === b.driverId ? 'Conducteur' : 'Propriétaire'} :</b> {m.body}</div>)}
      {['REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(b.status) ? (
        <div className="row" style={{ marginTop: 14 }}>
          <button className="danger" onClick={() => act(() => api(`/bookings/${id}/cancel`, { body: { reason: 'Annulée par Rentaya' } }), reload, 'Annuler cette réservation et rembourser intégralement le conducteur ?')}>Annuler (Rentaya)</button>
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------- Paiements ----------------
export function Payments() {
  const [status, setStatus] = useState('AWAITING_VALIDATION');
  const [method, setMethod] = useState('');
  const { data, reload } = useLoad('/admin/payments', { status, method });
  const rows = (data?.items || []).filter((p: any) => p.type !== 'REFUND');
  return (
    <>
      <h1>Paiements</h1>
      <div className="bar">
        <Filters value={status} onChange={setStatus} options={['PENDING', 'AWAITING_VALIDATION', 'PAID', 'FAILED', 'CANCELLED']} />
        <Filters value={method} onChange={setMethod} options={['CMI', 'WAFACASH', 'CASHPLUS', 'BANK_TRANSFER', 'WALLET']} placeholder="Tous moyens" />
      </div>
      <Table rows={rows} cols={[
        ['Référence', (p: any) => p.orderId], ['Réservation', (p: any) => p.booking?.reference || '—'], ['Client', (p: any) => `${p.user.firstName} ${p.user.lastName}`],
        ['Type', (p: any) => p.type], ['Moyen', (p: any) => p.method], ['Montant', (p: any) => mad(p.amount)], ['Preuve', (p: any) => (p.proofUrl ? <Img src={p.proofUrl} /> : '—')],
        ['Statut', (p: any) => <Badge v={p.status} />], ['Date', (p: any) => dt(p.createdAt)],
        ['Actions', (p: any) => (['AWAITING_VALIDATION', 'PENDING'].includes(p.status) && p.method !== 'CMI' ? (
          <div className="row">
            <button onClick={() => act(() => api(`/admin/payments/${p.id}/validate`, { body: {} }), reload, `Confirmer la réception de ${mad(p.amount)} (${p.method}, réf. ${p.orderId}) ?`)}>Valider</button>
            <button className="danger" onClick={() => act(() => api(`/admin/payments/${p.id}/reject`, { body: {} }), reload, 'Refuser ce paiement ?')}>Refuser</button>
          </div>
        ) : null)],
      ]} />
    </>
  );
}

export function Refunds() {
  const [status, setStatus] = useState('PENDING');
  const { data, reload } = useLoad('/admin/payments', { status, type: 'REFUND' });
  return (
    <>
      <h1>Remboursements</h1>
      <p>Effectuez le remboursement depuis l'espace marchand CMI (carte) ou par virement, puis marquez-le comme effectué.</p>
      <div className="bar"><Filters value={status} onChange={setStatus} options={['PENDING', 'REFUNDED']} /></div>
      <Table rows={data?.items || []} cols={[
        ['Référence', (p: any) => p.orderId], ['Réservation', (p: any) => p.booking?.reference], ['Client', (p: any) => `${p.user.firstName} ${p.user.lastName} — ${p.user.rib || p.user.email}`],
        ['Moyen d\'origine', (p: any) => `${p.method} ${(p.raw as any)?.originalOrderId || ''}`], ['Montant', (p: any) => mad(p.amount)], ['Motif', (p: any) => (p.raw as any)?.note],
        ['Statut', (p: any) => <Badge v={p.status} />],
        ['Action', (p: any) => (p.status === 'PENDING' ? <button onClick={async () => { const ref = await ask('Référence de l\'opération (CMI / virement)') || undefined; act(() => api(`/admin/payments/${p.id}/refunded`, { body: { providerRef: ref } }), reload); }}>Marquer remboursé</button> : p.providerRef)],
      ]} />
    </>
  );
}

// ---------------- Versements ----------------
export function Payouts() {
  const [status, setStatus] = useState('PENDING');
  const { data, reload } = useLoad('/admin/payouts', { status });
  return (
    <>
      <h1>Versements aux propriétaires</h1>
      <div className="bar">
        <Filters value={status} onChange={setStatus} options={['PENDING', 'PROCESSING', 'PAID', 'FAILED']} />
        <button className="secondary" onClick={() => act(async () => { const r = await api('/admin/payouts/generate', { body: {} }); notice(`${r.created} versement(s) créé(s)`); }, reload)}>Générer les versements</button>
      </div>
      <Table rows={data?.items || []} cols={[
        ['Propriétaire', (p: any) => `${p.owner.firstName} ${p.owner.lastName}${p.owner.companyName ? ` (${p.owner.companyName})` : ''}`],
        ['RIB', (p: any) => (p.owner.rib ? `${p.owner.bankName || ''} ${p.owner.rib}` : <Badge v="RIB MANQUANT" />)], ['Montant', (p: any) => mad(p.amount)],
        ['Locations', (p: any) => p.bookings.map((b: any) => b.reference).join(', ')], ['Statut', (p: any) => <Badge v={p.status} />], ['Créé', (p: any) => dt(p.createdAt)],
        ['Actions', (p: any) => (p.status !== 'PAID' ? (
          <div className="row">
            <button onClick={async () => { const reference = await ask('Référence du virement') || undefined; act(() => api(`/admin/payouts/${p.id}`, { body: { status: 'PAID', reference } }), reload); }}>Marquer payé</button>
            <button className="secondary" onClick={() => act(() => api(`/admin/payouts/${p.id}`, { body: { status: 'FAILED' } }), reload)}>Échec</button>
          </div>
        ) : p.reference)],
      ]} />
    </>
  );
}

// ---------------- Sinistres & frais ----------------
export function Claims() {
  const [status, setStatus] = useState('OPEN');
  const { data, reload } = useLoad('/admin/claims', { status });
  return (
    <>
      <h1>Sinistres</h1>
      <div className="bar"><Filters value={status} onChange={setStatus} options={['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']} /></div>
      <Table rows={data || []} cols={[
        ['Réservation', (c: any) => c.booking.reference], ['Véhicule', (c: any) => `${c.booking.car.make} ${c.booking.car.model}`],
        ['Déclarant', (c: any) => `${c.reporter.firstName} ${c.reporter.lastName}`], ['Description', (c: any) => c.description],
        ['Photos', (c: any) => <div className="row">{c.photos.map((u: string) => <Img key={u} src={u} />)}</div>], ['Estimation', (c: any) => (c.estimate ? mad(c.estimate) : '—')],
        ['Statut', (c: any) => <Badge v={c.status} />],
        ['Action', (c: any) => (
          <select value="" onChange={async (e) => { const s = e.target.value; if (!s) return; const resolution = await ask('Message aux parties (facultatif)') || undefined; act(() => api(`/admin/claims/${c.id}`, { method: 'PATCH', body: { status: s, resolution } }), reload); }}>
            <option value="">Changer…</option><option>UNDER_REVIEW</option><option>RESOLVED</option><option>REJECTED</option>
          </select>
        )],
      ]} />
    </>
  );
}

export function Charges() {
  const [status, setStatus] = useState('CONTESTED');
  const { data, reload } = useLoad('/admin/charges', { status });
  return (
    <>
      <h1>Frais supplémentaires</h1>
      <div className="bar"><Filters value={status} onChange={setStatus} options={['PENDING', 'ACCEPTED', 'CONTESTED', 'PAID', 'REJECTED']} /></div>
      <Table rows={data || []} cols={[
        ['Réservation', (c: any) => c.booking.reference], ['Type', (c: any) => c.type], ['Description', (c: any) => c.description], ['Montant', (c: any) => mad(c.amount)],
        ['Réponse conducteur', (c: any) => c.response || '—'], ['Justificatifs', (c: any) => <div className="row">{c.proofUrls.map((u: string) => <Img key={u} src={u} />)}</div>],
        ['Statut', (c: any) => <Badge v={c.status} />],
        ['Décision', (c: any) => (c.status === 'CONTESTED' || c.status === 'PENDING' ? (
          <div className="row">
            <button onClick={async () => { const a = await ask('Montant retenu (MAD)', String(c.amount)); if (a) act(() => api(`/admin/charges/${c.id}`, { body: { status: 'ACCEPTED', amount: Number(a) } }), reload); }}>Maintenir</button>
            <button className="danger" onClick={() => act(() => api(`/admin/charges/${c.id}`, { body: { status: 'REJECTED' } }), reload)}>Annuler</button>
          </div>
        ) : null)],
      ]} />
    </>
  );
}

// ---------------- Support & avis ----------------
export function Tickets() {
  const [status, setStatus] = useState('OPEN');
  const { data, reload } = useLoad('/admin/tickets', { status });
  return (
    <>
      <h1>Support</h1>
      <div className="bar"><Filters value={status} onChange={setStatus} options={['OPEN', 'PENDING', 'CLOSED']} /></div>
      <Table rows={data || []} cols={[
        ['Date', (t: any) => dt(t.createdAt)], ['Client', (t: any) => `${t.user.firstName} ${t.user.lastName} — ${t.user.email} ${t.user.phone || ''}`],
        ['Sujet', (t: any) => <b>{t.subject}</b>], ['Message', (t: any) => t.body], ['Réponse', (t: any) => t.reply || '—'], ['Statut', (t: any) => <Badge v={t.status} />],
        ['Action', (t: any) => <button onClick={async () => { const reply = await ask('Votre réponse', t.reply || ''); if (reply !== null) act(() => api(`/admin/tickets/${t.id}`, { body: { reply, status: 'CLOSED' } }), reload); }}>Répondre</button>],
      ]} />
    </>
  );
}

export function Reviews() {
  const { data, reload } = useLoad('/admin/reviews');
  return (
    <>
      <h1>Avis</h1>
      <Table rows={data || []} cols={[
        ['Date', (r: any) => dt(r.createdAt)], ['Auteur', (r: any) => `${r.author.firstName} ${r.author.lastName}`], ['Sur', (r: any) => `${r.targetUser.firstName} ${r.targetUser.lastName}`],
        ['Note', (r: any) => '★'.repeat(r.rating)], ['Commentaire', (r: any) => r.comment], ['Visible', (r: any) => (r.hidden ? <Badge v="MASQUÉ" /> : 'Oui')],
        ['Action', (r: any) => <button className="secondary" onClick={() => act(() => api(`/admin/reviews/${r.id}`, { body: { hidden: !r.hidden } }), reload)}>{r.hidden ? 'Afficher' : 'Masquer'}</button>],
      ]} />
    </>
  );
}

// ---------------- Codes promo ----------------
export function Promos() {
  const { data, reload } = useLoad('/admin/promos');
  const [f, setF] = useState<any>({ code: '', type: 'PERCENT', value: 10, maxDiscount: '', minAmount: 0, maxUses: '', firstBookingOnly: false, validTo: '' });
  const create = () => act(() => api('/admin/promos', { body: {
    ...f, value: Number(f.value), minAmount: Number(f.minAmount), maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null,
    maxUses: f.maxUses ? Number(f.maxUses) : null, validTo: f.validTo || null,
  } }), () => { reload(); setF({ ...f, code: '' }); });
  return (
    <>
      <h1>Codes promo</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input placeholder="CODE" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="PERCENT">%</option><option value="FIXED">MAD</option></select>
          <input type="number" placeholder="Valeur" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} style={{ width: 90 }} />
          <input type="number" placeholder="Remise max" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} style={{ width: 110 }} />
          <input type="number" placeholder="Montant min" value={f.minAmount} onChange={(e) => setF({ ...f, minAmount: e.target.value })} style={{ width: 110 }} />
          <input type="number" placeholder="Utilisations max" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} style={{ width: 130 }} />
          <input type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} />
          <label style={{ margin: 0 }}><input type="checkbox" checked={f.firstBookingOnly} onChange={(e) => setF({ ...f, firstBookingOnly: e.target.checked })} style={{ display: 'inline', width: 'auto' }} /> 1ʳᵉ location</label>
          <button disabled={f.code.length < 3} onClick={create}>Créer</button>
        </div>
      </div>
      <Table rows={data || []} cols={[
        ['Code', (p: any) => <b>{p.code}</b>], ['Remise', (p: any) => (p.type === 'PERCENT' ? `${p.value} %` : mad(p.value))], ['Max', (p: any) => (p.maxDiscount ? mad(p.maxDiscount) : '—')],
        ['Min', (p: any) => mad(p.minAmount)], ['Utilisé', (p: any) => `${p.usedCount}${p.maxUses ? ` / ${p.maxUses}` : ''}`], ['1ʳᵉ location', (p: any) => (p.firstBookingOnly ? 'Oui' : 'Non')],
        ['Fin', (p: any) => (p.validTo ? new Date(p.validTo).toLocaleDateString('fr-FR') : '—')], ['Actif', (p: any) => <Badge v={p.active ? 'ACTIVE' : 'PAUSED'} />],
        ['Actions', (p: any) => (
          <div className="row">
            <button className="secondary" onClick={() => act(() => api(`/admin/promos/${p.id}`, { method: 'PATCH', body: { active: !p.active } }), reload)}>{p.active ? 'Désactiver' : 'Activer'}</button>
            <button className="ghost" onClick={() => act(() => api(`/admin/promos/${p.id}`, { method: 'DELETE' }), reload, 'Supprimer ce code ?')}>Supprimer</button>
          </div>
        )],
      ]} />
    </>
  );
}

// ---------------- Assurances ----------------
export function Insurance() {
  const { data, reload } = useLoad('/admin/insurance');
  const [edit, setEdit] = useState<any>(null);
  const save = () => {
    const { id, bookings, ...body } = edit; void bookings;
    const payload = { ...body, pricePerDay: Number(body.pricePerDay), franchise: Number(body.franchise), position: Number(body.position || 0) };
    act(() => (id ? api(`/admin/insurance/${id}`, { method: 'PATCH', body: payload }) : api('/admin/insurance', { body: payload })), () => { setEdit(null); reload(); });
  };
  return (
    <>
      <h1>Formules d'assurance</h1>
      <p>Configurez les formules proposées aux conducteurs. Les tarifs et franchises seront à aligner sur le contrat de votre assureur partenaire.</p>
      <div className="bar"><button onClick={() => setEdit({ code: '', nameFr: '', nameAr: '', nameEn: '', descriptionFr: '', descriptionAr: '', descriptionEn: '', pricePerDay: 0, franchise: 0, roadside: true, position: 0, active: true })}>Nouvelle formule</button></div>
      <Table rows={data || []} onRow={setEdit} cols={[
        ['Code', (p: any) => p.code], ['Nom', (p: any) => p.nameFr], ['Prix / jour', (p: any) => mad(p.pricePerDay)], ['Franchise', (p: any) => mad(p.franchise)],
        ['Assistance', (p: any) => (p.roadside ? 'Oui' : 'Non')], ['Active', (p: any) => <Badge v={p.active ? 'ACTIVE' : 'PAUSED'} />],
      ]} />
      {edit ? (
        <Modal title={edit.id ? edit.nameFr : 'Nouvelle formule'} onClose={() => setEdit(null)}>
          <div className="grid2">
            {['code', 'position', 'pricePerDay', 'franchise', 'nameFr', 'nameEn', 'nameAr'].map((k) => <label key={k}>{k}<input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} dir={k.endsWith('Ar') ? 'rtl' : undefined} /></label>)}
          </div>
          {['descriptionFr', 'descriptionEn', 'descriptionAr'].map((k) => <label key={k}>{k}<textarea value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} dir={k.endsWith('Ar') ? 'rtl' : undefined} /></label>)}
          <label><input type="checkbox" style={{ display: 'inline', width: 'auto' }} checked={edit.roadside} onChange={(e) => setEdit({ ...edit, roadside: e.target.checked })} /> Assistance incluse</label>
          <label><input type="checkbox" style={{ display: 'inline', width: 'auto' }} checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
          <button onClick={save} style={{ marginTop: 12 }}>Enregistrer</button>
        </Modal>
      ) : null}
    </>
  );
}

// ---------------- Centre d'aide ----------------
export function Help() {
  const { data, reload } = useLoad('/admin/help');
  const [edit, setEdit] = useState<any>(null);
  const save = () => {
    const { id, updatedAt, ...body } = edit; void updatedAt;
    act(() => (id ? api(`/admin/help/${id}`, { method: 'PATCH', body: { ...body, position: Number(body.position) } }) : api('/admin/help', { body: { ...body, position: Number(body.position) } })), () => { setEdit(null); reload(); });
  };
  return (
    <>
      <h1>Centre d'aide</h1>
      <div className="bar"><button onClick={() => setEdit({ slug: '', locale: 'fr', category: '', title: '', body: '', position: 0, published: true })}>Nouvel article</button></div>
      <Table rows={data || []} onRow={setEdit} cols={[['Langue', (a: any) => a.locale], ['Catégorie', (a: any) => a.category], ['Titre', (a: any) => a.title], ['Slug', (a: any) => a.slug], ['Publié', (a: any) => (a.published ? 'Oui' : 'Non')]]} />
      {edit ? (
        <Modal title={edit.title || 'Nouvel article'} onClose={() => setEdit(null)}>
          <div className="grid2">
            <label>Slug<input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></label>
            <label>Langue<select value={edit.locale} onChange={(e) => setEdit({ ...edit, locale: e.target.value })}><option>fr</option><option>ar</option><option>en</option></select></label>
            <label>Catégorie<input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></label>
            <label>Position<input value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></label>
          </div>
          <label>Titre<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} dir={edit.locale === 'ar' ? 'rtl' : undefined} /></label>
          <label>Contenu<textarea style={{ minHeight: 200 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} dir={edit.locale === 'ar' ? 'rtl' : undefined} /></label>
          <div className="row">
            <button onClick={save}>Enregistrer</button>
            {edit.id ? <button className="danger" onClick={() => act(() => api(`/admin/help/${edit.id}`, { method: 'DELETE' }), () => { setEdit(null); reload(); }, 'Supprimer ?')}>Supprimer</button> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

// ---------------- Paramètres ----------------
const SETTING_LABELS: Record<string, string> = {
  serviceFeePercent: 'Frais de service conducteur (%)', minServiceFee: 'Frais de service minimum (MAD)', commissionPercent: 'Commission sur le propriétaire (%)',
  requestExpiryHours: 'Délai de réponse du propriétaire (h)', cashPaymentWindowHours: 'Délai de paiement (h)', ownerCancelPenalty: 'Pénalité annulation propriétaire (MAD)',
  lateFeePerHour: 'Frais de retard (MAD/h)', cleaningFee: 'Frais de nettoyage (MAD)', fuelPricePerLiter: 'Prix du carburant (MAD/L)',
  referralBonusReferee: 'Bonus filleul (MAD)', referralBonusReferrer: 'Bonus parrain (MAD)', payoutDelayDays: 'Délai avant versement (jours)',
  supportPhone: 'Téléphone support', supportEmail: 'E-mail support', bankTransferRib: 'RIB Rentaya (virements / Wafacash / Cash Plus)', bankTransferHolder: 'Bénéficiaire',
};
export function Settings() {
  const { data, reload } = useLoad<Record<string, any>>('/admin/settings');
  const [f, setF] = useState<Record<string, any> | null>(null);
  const v = f || data;
  if (!v) return <p>Chargement…</p>;
  const save = () => act(() => api('/admin/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof data![k] === 'number' ? Number(x) : x])) }), () => { setF(null); reload(); notice('Paramètres enregistrés'); });
  return (
    <>
      <h1>Paramètres de la plateforme</h1>
      <div className="card">
        <div className="grid2">
          {Object.keys(v).map((k) => <label key={k}>{SETTING_LABELS[k] || k}<input value={v[k]} onChange={(e) => setF({ ...v, [k]: e.target.value })} /></label>)}
        </div>
        <button style={{ marginTop: 16 }} onClick={save}>Enregistrer</button>
      </div>
    </>
  );
}
