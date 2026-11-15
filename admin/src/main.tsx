import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api, DEMO, getToken, setToken } from './api';
import * as P from './pages';
import { DialogHost } from './ui';

const NAV: [string, string, React.FC, string?][] = [
  ['dashboard', 'Tableau de bord', P.Dashboard],
  ['users', 'Utilisateurs', P.Users, 'pendingUsers'],
  ['cars', 'Annonces', P.Cars, 'pendingCars'],
  ['bookings', 'Réservations', P.Bookings],
  ['payments', 'Paiements', P.Payments, 'awaitingPayments'],
  ['refunds', 'Remboursements', P.Refunds, 'pendingRefunds'],
  ['payouts', 'Versements', P.Payouts, 'pendingPayouts'],
  ['claims', 'Sinistres', P.Claims, 'openClaims'],
  ['charges', 'Frais contestés', P.Charges, 'contested'],
  ['tickets', 'Support', P.Tickets, 'openTickets'],
  ['reviews', 'Avis', P.Reviews],
  ['promos', 'Codes promo', P.Promos],
  ['insurance', 'Assurances', P.Insurance],
  ['help', 'Centre d\'aide', P.Help],
  ['settings', 'Paramètres', P.Settings],
];

function Login({ setLogged }: { setLogged: (v: boolean) => void }) {
  const [email, setEmail] = useState(DEMO ? 'admin@rentaya.ma' : '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { body: { email, password } });
      if (r.user.role !== 'ADMIN') return setErr('Accès réservé aux administrateurs.');
      setToken(r.token); if (DEMO) setLogged(true); else location.reload();
    } catch (e) { setErr((e as Error).message === 'INVALID_CREDENTIALS' ? 'Identifiants incorrects.' : (e as Error).message); }
  };
  return (
    <form className="login" onSubmit={submit}>
      <img src="/logo.png" alt="Rentaya" />
      <h2>Back-office Rentaya</h2>
      <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {DEMO ? <p className="demo">Version de démonstration : données fictives, n'importe quel mot de passe fonctionne. Tout est réinitialisé au rechargement.</p> : null}
      {err ? <p className="err">{err}</p> : null}
      <button>Se connecter</button>
    </form>
  );
}

function App() {
  const [page, setPage] = useState(location.hash.slice(1) || 'dashboard');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [logged, setLogged] = useState(!!getToken());
  useEffect(() => {
    const onHash = () => setPage(location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', onHash);
    const load = () => { if (getToken()) api('/admin/stats').then(setStats).catch(() => {}); };
    load(); const i = setInterval(load, 30000);
    return () => { window.removeEventListener('hashchange', onHash); clearInterval(i); };
  }, []);
  useEffect(() => { if (logged) api('/admin/stats').then(setStats).catch(() => {}); }, [logged, page]);
  if (!logged) return <Login setLogged={setLogged} />;
  const Current = (NAV.find((n) => n[0] === page) || NAV[0])[2];
  return (
    <div className="layout">
      <nav className="side">
        <div className="brand"><img src="/logo.png" alt="" />RENTAYA</div>
        {NAV.map(([id, label, , k]) => (
          <a key={id} href={`#${id}`} className={page === id ? 'on' : ''}>{label}{k && stats[k] ? <span className="count">{stats[k]}</span> : null}</a>
        ))}
        <a href="#" onClick={() => { setToken(null); setLogged(false); }}>Déconnexion</a>
      </nav>
      <main><Current /></main>
      <DialogHost />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
