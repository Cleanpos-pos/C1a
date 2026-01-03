import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Phone, Clock, MapPin, Truck, Leaf, Shirt, ArrowRight, Settings, Lock, ShoppingBag, Plus, Loader2, TrendingUp, AlertCircle, Edit3, BedDouble, Sparkles, Check, Upload, ToggleLeft, ToggleRight, Users, Tag, Gift, Ticket, Search, Package, Calendar, ChevronDown, ChevronUp, Minus, Repeat, Mail, UserPlus, Info, Send, FileText, Copy, Save, Download, User, LogIn, FileCheck, Scissors, Droplet, Trash2 } from 'lucide-react';
import { Page, TimeSlot, CartItem, DeliveryOption } from './types';
import { supabase } from './supabaseClient';
import { sendOrderConfirmation } from './services/emailService';
import Assistant from './components/Assistant';

/* 
  IMPORTANT: SQL UPDATE REQUIRED
  Run this in Supabase SQL Editor if you haven't already:

  ALTER TABLE cp_customers 
  ADD COLUMN IF NOT EXISTS starch_level text DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS finish_style text DEFAULT 'On Hanger',
  ADD COLUMN IF NOT EXISTS trouser_crease text DEFAULT 'Natural Crease',
  ADD COLUMN IF NOT EXISTS auth_repairs boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS detergent text DEFAULT 'Standard Scent',
  ADD COLUMN IF NOT EXISTS no_plastic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recycle_hangers boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

  ALTER TABLE cp_orders ADD COLUMN IF NOT EXISTS preferences jsonb;
  ALTER TABLE cp_app_settings ADD CONSTRAINT cp_app_settings_key_key UNIQUE (key);
*/

// --- Types ---
interface Promotion {
  id: string;
  type: 'bogo' | 'bundle';
  name: string;
  active: boolean;
  buy_qty: number;
  get_qty: number;
  bundle_qty: number;
  bundle_price: number;
  included_items: string[];
}

interface ServiceCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface ServiceProduct {
  id: string;
  category: string;
  name: string;
  price: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'transactional' | 'marketing';
  variables: string[];
}

// --- Helper Functions ---

const getNextDate = (dayName: string) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const targetDay = days.indexOf(dayName);
  if (targetDay === -1) return dayName;

  const currentDay = today.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7; 

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
};

const generateInvoice = async (order: any) => {
  const { data: settingsData } = await supabase.from('cp_app_settings').select('*');
  const settings: any = {};
  if (settingsData) {
    settingsData.forEach((item: any) => { settings[item.key] = item.value; });
  }

  const storeName = settings.store_name || 'Class 1 Dry Cleaners';
  const storeAddress = settings.store_address || '67 Stoney Ln, Weeke, Winchester SO22 6EW';
  const storeVat = settings.store_vat || '';
  const storePhone = settings.store_phone || '01962 861998';
  const storeEmail = settings.store_email || 'info@class1.co.uk';
  const footer = settings.invoice_footer || 'Thank you for your business!';

  const total = order.items ? order.items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * item.quantity), 0) : 0;
  const discount = order.discount_amount || 0;
  const finalTotal = total - discount;

  let prefsHtml = '';
  if (order.preferences) {
      prefsHtml = `
        <div style="margin-bottom: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 5px; font-size: 12px; color: #555;">
            <strong>Cleaning Preferences:</strong><br/>
            Shirts: ${order.preferences.starch} Starch, ${order.preferences.finish}<br/>
            Care: ${order.preferences.detergent}, ${order.preferences.trouser_crease}<br/>
            ${order.preferences.auth_repairs ? '✔ Authorized Minor Repairs (£5 max)<br/>' : ''}
            ${order.preferences.no_plastic ? '✔ No Plastic Covers<br/>' : ''}
            ${order.preferences.recycle_hangers ? '✔ Recycle Hangers<br/>' : ''}
        </div>
      `;
  }

  const invoiceHTML = `
    <html>
      <head>
        <title>Invoice #${order.readable_id}</title>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
          .company-info h1 { margin: 0 0 10px 0; color: #0056b3; }
          .company-info p { margin: 2px 0; font-size: 14px; color: #666; }
          .invoice-details { text-align: right; }
          .invoice-details h2 { margin: 0 0 10px 0; color: #333; }
          .bill-to { margin-bottom: 30px; }
          .bill-to h3 { margin: 0 0 10px 0; font-size: 16px; color: #666; text-transform: uppercase; }
          table { w-full; width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { text-align: left; padding: 12px; border-bottom: 2px solid #eee; color: #666; font-size: 14px; text-transform: uppercase; }
          td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
          .total-section { display: flex; justify-content: flex-end; }
          .total-table { width: 300px; }
          .total-table td { border: none; padding: 5px 12px; }
          .total-table .final { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 10px; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${storeName}</h1>
            <p>${storeAddress.replace(/\n/g, '<br>')}</p>
            <p>Phone: ${storePhone}</p>
            <p>Email: ${storeEmail}</p>
            ${storeVat ? `<p>VAT: ${storeVat}</p>` : ''}
          </div>
          <div class="invoice-details">
            <h2>INVOICE</h2>
            <p><strong>Order #:</strong> ${order.readable_id}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
          </div>
        </div>

        <div class="bill-to">
          <h3>Bill To:</h3>
          <p><strong>${order.customer_name}</strong></p>
          <p>${order.customer_address}</p>
          <p>${order.customer_email}</p>
          <p>${order.customer_phone}</p>
        </div>

        ${prefsHtml}

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item: any) => `
              <tr>
                <td>${item.name} ${item.note ? `<br><span style="font-size:11px; color:#888;">Note: ${item.note}</span>` : ''}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">£${parseFloat(item.price).toFixed(2)}</td>
                <td style="text-align: right;">£${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <table class="total-table">
            <tr>
              <td>Subtotal</td>
              <td style="text-align: right;">£${total.toFixed(2)}</td>
            </tr>
            ${discount > 0 ? `
            <tr>
              <td style="color: green;">Discount</td>
              <td style="text-align: right; color: green;">-£${discount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="final">Total</td>
              <td class="final" style="text-align: right;">£${finalTotal.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>${footer}</p>
        </div>
        
        <script>window.print();</script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
  }
};

// --- Components ---

const Header: React.FC<{ currentPage: Page; setPage: (p: Page) => void; cartCount: number; onLoginClick: () => void; isLoggedIn: boolean; onLogout: () => void }> = ({ currentPage, setPage, cartCount, onLoginClick, isLoggedIn, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems: { label: string; page: Page }[] = [{ label: 'Home', page: 'home' }, { label: 'Services & Pricing', page: 'services' }, { label: 'Contact', page: 'contact' }];
  return (
    <header className="fixed w-full top-0 bg-white/95 backdrop-blur-sm shadow-sm z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center cursor-pointer" onClick={() => setPage('home')}>
            <div className="bg-trust-blue text-white font-heading font-bold text-2xl px-2 py-1 rounded-sm mr-2">C1</div>
            <span className="font-heading font-bold text-xl sm:text-2xl text-trust-blue tracking-tight">CLASS 1 <span className="text-text-grey font-light">DRY CLEANERS</span></span>
          </div>
          <nav className="hidden md:flex space-x-6 items-center">
            {navItems.map((item) => (<button key={item.page} onClick={() => setPage(item.page)} className={`text-sm font-semibold transition-colors ${currentPage === item.page ? 'text-trust-blue' : 'text-gray-500 hover:text-trust-blue'}`}>{item.label}</button>))}
            {isLoggedIn ? (<div className="flex items-center gap-4"><button onClick={() => setPage('customer-portal' as Page)} className={`text-sm font-semibold flex items-center gap-1 transition-colors ${currentPage === 'customer-portal' as Page ? 'text-trust-blue' : 'text-gray-500 hover:text-trust-blue'}`}><User size={16} /> My Account</button><button onClick={onLogout} className="text-sm font-semibold text-red-500 hover:text-red-700">Logout</button></div>) : (<div className="flex items-center gap-2"><button onClick={onLoginClick} className="text-sm font-semibold flex items-center gap-1 text-gray-500 hover:text-trust-blue"><LogIn size={16} /> Log In</button><button onClick={onLoginClick} className="text-sm font-bold bg-trust-blue text-white px-4 py-1.5 rounded-full hover:bg-trust-blue-hover transition">Sign Up</button></div>)}
            <button onClick={() => setPage('booking')} className="relative bg-trust-blue hover:bg-trust-blue-hover text-white px-6 py-2.5 rounded-full font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"><span>Book Collection</span>{cartCount > 0 && (<span className="bg-eco-green text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{cartCount}</span>)}</button>
          </nav>
          <div className="md:hidden"><button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-600 p-2">{mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}</button></div>
        </div>
      </div>
      {mobileMenuOpen && (<div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg"><div className="px-4 pt-2 pb-6 space-y-2">{navItems.map((item) => (<button key={item.page} onClick={() => { setPage(item.page); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-3 text-base font-medium rounded-md ${currentPage === item.page ? 'bg-blue-50 text-trust-blue' : 'text-gray-700 hover:bg-gray-50'}`}>{item.label}</button>))}<button onClick={() => { if(isLoggedIn) { setPage('customer-portal' as Page); } else { onLoginClick(); } setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2">{isLoggedIn ? <><User size={16}/> My Account</> : <><LogIn size={16}/> Log In / Sign Up</>}</button><button onClick={() => { setPage('booking'); setMobileMenuOpen(false); }} className="w-full mt-4 bg-trust-blue text-white px-3 py-3 rounded-md font-bold text-center flex justify-center items-center gap-2">Book Collection {cartCount > 0 && (<span className="bg-white text-trust-blue text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>)}</button></div></div>)}
    </header>
  );
};

const Footer: React.FC<{ setPage: (p: Page) => void; onStaffLogin: (type: 'admin' | 'driver') => void }> = ({ setPage, onStaffLogin }) => {
  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div><div className="font-heading font-bold text-2xl tracking-tight mb-4 text-white">CLASS 1 <span className="text-gray-400 font-light">DRY CLEANERS</span></div><p className="text-gray-400 text-sm leading-relaxed">Professional dry cleaning and laundry services in Winchester.</p></div>
          <div><h4 className="font-bold text-lg mb-4">Quick Links</h4><ul className="space-y-2 text-sm text-gray-400"><li><button onClick={() => setPage('home')} className="hover:text-white transition">Home</button></li><li><button onClick={() => setPage('services')} className="hover:text-white transition">Services</button></li><li><button onClick={() => setPage('booking')} className="hover:text-white transition">Book Collection</button></li><li><button onClick={() => setPage('track-order')} className="hover:text-white transition">Track Order</button></li></ul></div>
          <div><h4 className="font-bold text-lg mb-4">Services</h4><ul className="space-y-2 text-sm text-gray-400"><li>Dry Cleaning</li><li>Laundry Service</li><li>Wedding Dresses</li><li>Alterations & Repairs</li><li>Household Items</li></ul></div>
          <div><h4 className="font-bold text-lg mb-4">Contact</h4><ul className="space-y-2 text-sm text-gray-400"><li className="flex items-start gap-2"><MapPin size={16} className="mt-1 shrink-0"/> 67 Stoney Ln, Weeke,<br/>Winchester, SO22 6EW</li><li className="flex items-center gap-2"><Phone size={16}/> 01962 861998</li><li className="flex items-center gap-2"><Clock size={16}/> Mon-Sat: 8:30am - 5:30pm</li></ul></div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Class 1 Dry Cleaners. All rights reserved.</p><div className="flex gap-4 text-sm text-gray-500"><button onClick={() => onStaffLogin('admin')} className="hover:text-white flex items-center gap-1"><Lock size={12}/> Admin</button><button onClick={() => onStaffLogin('driver')} className="hover:text-white flex items-center gap-1"><Truck size={12}/> Driver</button></div></div>
      </div>
    </footer>
  );
};

const StaffLoginModal: React.FC<{ isOpen: boolean; type: 'admin' | 'driver' | null; onClose: () => void; onLogin: () => void }> = ({ isOpen, type, onClose, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); if ((type === 'admin' && password === 'admin123') || (type === 'driver' && password === 'driver123')) { onLogin(); setPassword(''); setError(''); } else { setError('Incorrect password'); } };
  if (!isOpen) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm relative"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button><div className="text-center mb-6"><div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${type === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{type === 'admin' ? <Lock size={24} /> : <Truck size={24} />}</div><h2 className="text-xl font-bold text-gray-900">{type === 'admin' ? 'Admin' : 'Driver'} Login</h2><p className="text-gray-500 text-sm">Authorized personnel only</p></div><form onSubmit={handleLogin}><div className="mb-4"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter Access Code" className="w-full border-2 border-gray-200 rounded-lg p-3 text-center font-bold tracking-widest focus:border-trust-blue outline-none transition" autoFocus /></div>{error && <p className="text-red-500 text-sm text-center mb-4 font-bold">{error}</p>}<button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition">Access Portal</button><div className="mt-4 text-center text-xs text-gray-400"><p>Demo: admin123 / driver123</p></div></form></div></div>);
};

const CustomerLoginModal: React.FC<{ isOpen: boolean; onClose: () => void; onLogin: (user: any) => void }> = ({ isOpen, onClose, onLogin }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleAuth = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setError(''); if (isSignUp) { if (!name || !phone || !email || !password) { setError('All fields are required.'); setLoading(false); return; } const { data: existingUser } = await supabase.from('cp_customers').select('id').eq('email', email).single(); if (existingUser) { setError('Email already registered.'); setLoading(false); return; } const { data, error: insertError } = await supabase.from('cp_customers').insert([{ name, email, phone, password, loyalty_points: 0 }]).select().single(); if (insertError || !data) { setError('Failed to create account.'); } else { onLogin(data); onClose(); } } else { const { data, error } = await supabase.from('cp_customers').select('*').eq('email', email).single(); if (error || !data) { setError('Account not found.'); } else if (data.password !== password) { setError('Incorrect password.'); } else { onLogin(data); onClose(); } } setLoading(false); };
    if (!isOpen) return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm relative"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button><div className="text-center mb-6"><h2 className="text-2xl font-bold text-gray-900">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2><p className="text-gray-500 text-sm">{isSignUp ? 'Join us to track orders & earn rewards' : 'Log in to manage your orders'}</p></div><form onSubmit={handleAuth} className="space-y-4">{isSignUp && (<><div><label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2" /></div><div><label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label><input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full border rounded p-2" /></div></>)}<div><label className="block text-xs font-bold text-gray-700 mb-1">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded p-2" /></div><div><label className="block text-xs font-bold text-gray-700 mb-1">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded p-2" /></div>{error && <p className="text-red-500 text-xs text-center">{error}</p>}<button type="submit" disabled={loading} className="w-full bg-trust-blue text-white font-bold py-3 rounded-lg hover:bg-trust-blue-hover disabled:opacity-50">{loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Log In')}</button></form><div className="mt-4 text-center text-sm"><button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-trust-blue font-bold hover:underline">{isSignUp ? 'Already have an account? Log In' : 'New here? Create an Account'}</button></div></div></div>);
};

const CustomerPortalPage: React.FC<{ user: any; onUpdateUser: (u: any) => void }> = ({ user, onUpdateUser }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState({ 
        name: user.name || '', 
        phone: user.phone || '', 
        address: user.address || '', 
        notes: user.notes || '',
        starch: user.starch_level || 'None',
        finish: user.finish_style || 'On Hanger',
        crease: user.trouser_crease || 'Natural Crease',
        repairs: user.auth_repairs || false,
        detergent: user.detergent || 'Standard Scent',
        noPlastic: user.no_plastic || false,
        recycleHangers: user.recycle_hangers || false
    });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            const { data } = await supabase.from('cp_orders').select('*').eq('customer_email', user.email).order('created_at', { ascending: false });
            if (data) setOrders(data);
            setLoading(false);
        };
        fetchHistory();
    }, [user.email]);

    const handleSaveProfile = async () => {
        setSaving(true);
        const { error } = await supabase.from('cp_customers').update({
            name: profile.name, 
            phone: profile.phone, 
            address: profile.address, 
            notes: profile.notes,
            starch_level: profile.starch,
            finish_style: profile.finish,
            trouser_crease: profile.crease,
            auth_repairs: profile.repairs,
            detergent: profile.detergent,
            no_plastic: profile.noPlastic,
            recycle_hangers: profile.recycleHangers
        }).eq('email', user.email);

        if (!error) {
            setMsg('Saved Successfully!');
            onUpdateUser({ 
                ...user, ...profile, 
                starch_level: profile.starch,
                finish_style: profile.finish,
                trouser_crease: profile.crease,
                auth_repairs: profile.repairs,
                detergent: profile.detergent,
                no_plastic: profile.noPlastic,
                recycle_hangers: profile.recycleHangers
            });
            setTimeout(() => setMsg(''), 3000);
        } else {
            setMsg('Save failed. Run SQL update script.');
            console.error(error);
        }
        setSaving(false);
    };

    return (
        <div className="pt-28 pb-20 max-w-6xl mx-auto px-4 animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div><h1 className="font-heading font-bold text-3xl text-gray-900">My Account</h1><p className="text-gray-600">Welcome back, {user.name}</p></div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg text-center"><span className="block text-xs text-blue-600 font-bold uppercase">Loyalty Points</span><span className="text-2xl font-bold text-trust-blue">{user.loyalty_points || 0}</span></div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><User size={20} className="text-trust-blue"/> Contact Details</h3>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label><input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Phone</label><input type="text" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Default Address</label><textarea rows={3} value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Delivery Notes</label><textarea rows={2} value={profile.notes} onChange={e => setProfile({...profile, notes: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="e.g. Gate code 1234"/></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Settings size={20} className="text-trust-blue"/> Cleaning Preferences</h3>
                        <div className="space-y-6">
                            <div><h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1"><Shirt size={14}/> Shirt Essentials</h4><div className="space-y-3"><div><label className="block text-xs text-gray-600 mb-1">Starch Level</label><select value={profile.starch} onChange={e => setProfile({...profile, starch: e.target.value})} className="w-full border rounded p-2 text-sm bg-gray-50"><option value="None">None</option><option value="Light">Light</option><option value="Medium">Medium</option><option value="Heavy">Heavy</option></select></div><div><label className="block text-xs text-gray-600 mb-1">Finish Style</label><div className="flex gap-2">{['On Hanger', 'Folded'].map(opt => (<button key={opt} onClick={() => setProfile({...profile, finish: opt})} className={`flex-1 py-1.5 text-xs rounded border ${profile.finish === opt ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-gray-600 border-gray-300'}`}>{opt}</button>))}</div></div></div></div>
                            <div className="pt-4 border-t border-gray-100"><h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1"><Scissors size={14}/> General Care</h4><div className="space-y-3"><div><label className="block text-xs text-gray-600 mb-1">Trouser Creases</label><select value={profile.crease} onChange={e => setProfile({...profile, crease: e.target.value})} className="w-full border rounded p-2 text-sm bg-gray-50"><option value="Natural Crease">Natural Crease</option><option value="Sharp Crease">Sharp Crease</option><option value="No Crease">No Crease (Flat Press)</option></select></div><label className="flex items-center gap-2 cursor-pointer"><div className={`w-10 h-5 rounded-full p-1 transition-colors ${profile.repairs ? 'bg-green-500' : 'bg-gray-300'}`} onClick={() => setProfile({...profile, repairs: !profile.repairs})}><div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${profile.repairs ? 'translate-x-5' : 'translate-x-0'}`}/></div><span className="text-xs text-gray-700">Authorize Repairs (up to £5)</span></label></div></div>
                            <div className="pt-4 border-t border-gray-100"><h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1"><Leaf size={14}/> Eco & Health</h4><div className="space-y-3"><div><label className="block text-xs text-gray-600 mb-1">Detergent Preference</label><select value={profile.detergent} onChange={e => setProfile({...profile, detergent: e.target.value})} className="w-full border rounded p-2 text-sm bg-gray-50"><option value="Standard Scent">Standard Scent</option><option value="Hypoallergenic">Hypoallergenic (Unscented)</option><option value="Organic">Organic / Green Solvent</option></select></div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={profile.noPlastic} onChange={e => setProfile({...profile, noPlastic: e.target.checked})} className="rounded text-trust-blue focus:ring-trust-blue" /><span className="text-xs text-gray-700">No Plastic Covers</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={profile.recycleHangers} onChange={e => setProfile({...profile, recycleHangers: e.target.checked})} className="rounded text-trust-blue focus:ring-trust-blue" /><span className="text-xs text-gray-700">Recycle Hangers (Driver will collect)</span></label></div></div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-200">{msg && <p className={`text-xs font-bold mb-2 text-center ${msg.includes('fail') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}<button onClick={handleSaveProfile} disabled={saving} className="w-full bg-trust-blue text-white py-3 rounded-lg text-sm font-bold hover:bg-trust-blue-hover transition flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Save All Preferences</>}</button></div>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-gray-700 flex items-center gap-2"><ShoppingBag size={18} /> Order History</div>
                    {loading ? <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-trust-blue"/></div> : orders.length === 0 ? <div className="p-8 text-center text-gray-500">You haven't placed any orders yet.</div> : (
                        <div className="divide-y divide-gray-100 max-h-[800px] overflow-y-auto">
                            {orders.map(order => (
                                <div key={order.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50 transition">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1"><span className="font-bold text-lg">#{order.readable_id}</span><span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{order.status}</span></div>
                                        <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()} • {order.items?.length || 0} Items</p>
                                    </div>
                                    <div className="flex items-center gap-3"><button onClick={() => generateInvoice(order)} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-trust-blue border border-gray-300 rounded px-4 py-2 hover:bg-white transition"><FileCheck size={16} /> Invoice</button></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const BackOfficePage: React.FC<{ 
  availableSlots: TimeSlot[]; 
  setAvailableSlots: React.Dispatch<React.SetStateAction<TimeSlot[]>>;
  deliveryOptions: DeliveryOption[];
  setDeliveryOptions: React.Dispatch<React.SetStateAction<DeliveryOption[]>>;
}> = ({ availableSlots, setAvailableSlots, deliveryOptions, setDeliveryOptions }) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'store' | 'service' | 'orders' | 'customers' | 'offers' | 'schedule' | 'marketing'>('orders');
  const [saved, setSaved] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerFilter, setCustomerFilter] = useState({ name: '', phone: '', postcode: '' });
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [promotions, setPromotions] = useState<any[]>([]);
  const [bogoForm, setBogoForm] = useState<any>({ type: 'bogo', active: true, buy_qty: 3, get_qty: 1, included_items: [] });
  const [bundleForm, setBundleForm] = useState<any>({ type: 'bundle', active: true, bundle_qty: 5, bundle_price: 20, included_items: [] });
  const [newSlotTime, setNewSlotTime] = useState('');
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('order_received');

  useEffect(() => {
    fetchOrders(); fetchDrivers(); fetchSettings(); fetchServices(); fetchCategories(); fetchCustomers(); fetchPromotions(); fetchEmailTemplates();
  }, []);

  const fetchEmailTemplates = async () => { const { data } = await supabase.from('cp_email_templates').select('*'); if (data && data.length > 0) { setEmailTemplates(data); if (!selectedTemplateId) setSelectedTemplateId(data[0].id); } };
  const fetchPromotions = async () => { const { data } = await supabase.from('cp_promotions').select('*'); if (data) setPromotions(data); };
  const fetchCustomers = async () => { const { data } = await supabase.from('cp_customers').select('*').order('created_at', { ascending: false }); if (data) setCustomers(data); };
  const fetchCategories = async () => { const { data } = await supabase.from('cp_categories').select('*').order('sort_order', { ascending: true }); if (data) setCategories(data); };
  const fetchServices = async () => { const { data } = await supabase.from('cp_services').select('*').order('category'); if (data) setServices(data); };
  const fetchOrders = async () => { const { data } = await supabase.from('cp_orders').select('*, cp_drivers(name)').order('created_at', { ascending: false }); if (data) setOrders(data); };
  const fetchDrivers = async () => { const { data } = await supabase.from('cp_drivers').select('*'); if (data) setDrivers(data); };
  const fetchSettings = async () => { const { data } = await supabase.from('cp_app_settings').select('*'); if (data) { const newSettings: any = {}; data.forEach((item: any) => { newSettings[item.key] = item.value; }); setSettings(prev => ({ ...prev, ...newSettings })); } };

  // Improved Save Handler with onConflict
  const handleSaveSettings = async (updatedSettings?: any) => {
    const toSave = updatedSettings || settings;
    const updates = Object.keys(toSave).map(key => ({ key, value: String(toSave[key] || '') }));
    const { error } = await supabase.from('cp_app_settings').upsert(updates, { onConflict: 'key' });
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000); setSettings(toSave); } else { console.error(error); alert('Failed to save settings. Check DB constraints.'); }
  };
  
  const updatePosTicket = async (orderId: string, ticketId: string) => { await supabase.from('cp_orders').update({ pos_ticket_id: ticketId }).eq('id', orderId); setOrders(orders.map(o => o.id === orderId ? { ...o, pos_ticket_id: ticketId } : o)); };
  const saveBogoPromotion = async () => { const promoData = { ...bogoForm, name: 'Buy X Get Y Free' }; const { data, error } = await supabase.from('cp_promotions').insert([promoData]).select(); if (!error && data) { setPromotions([...promotions, data[0]]); setBogoForm({ type: 'bogo', active: true, buy_qty: 3, get_qty: 1, included_items: [] }); } else { alert('Error saving BOGO promotion.'); } };
  const saveBundlePromotion = async () => { const promoData = { ...bundleForm, name: 'Bundle Deal' }; const { data, error } = await supabase.from('cp_promotions').insert([promoData]).select(); if (!error && data) { setPromotions([...promotions, data[0]]); setBundleForm({ type: 'bundle', active: true, bundle_qty: 5, bundle_price: 20, included_items: [] }); } else { alert('Error saving Bundle promotion.'); } };
  const deletePromo = async (id: string) => { await supabase.from('cp_promotions').delete().eq('id', id); setPromotions(promotions.filter(p => p.id !== id)); };
  const saveCustomer = async () => { if (!editingCustomer) return; const { error } = await supabase.from('cp_customers').update({ name: editingCustomer.name, phone: editingCustomer.phone, email: editingCustomer.email, address: editingCustomer.address }).eq('id', editingCustomer.id); if (!error) { setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c)); setEditingCustomer(null); } };
  const toggleDay = async (day: string) => { const key = `day_active_${day}`; const newVal = settings[key] === 'true' ? 'false' : 'true'; handleSaveSettings({ ...settings, [key]: newVal }); };
  const addSlotToDay = async (day: string) => { if (!newSlotTime) return; const { data } = await supabase.from('cp_time_slots').insert([{ day, label: newSlotTime, active: true }]).select(); if (data) { setAvailableSlots([...availableSlots, data[0] as TimeSlot]); setNewSlotTime(''); } };
  const deleteSlot = async (id: string) => { await supabase.from('cp_time_slots').delete().eq('id', id); setAvailableSlots(availableSlots.filter(s => s.id !== id)); };
  const updateOrderStatus = async (orderId: string, status: string) => { await supabase.from('cp_orders').update({ status }).eq('id', orderId); fetchOrders(); };
  const updateOrderDriver = async (orderId: string, driverId: string) => { await supabase.from('cp_orders').update({ driver_id: driverId }).eq('id', orderId); fetchOrders(); };
  const togglePromoItem = (formType: 'bogo' | 'bundle', itemName: string) => { if (formType === 'bogo') { const items = bogoForm.included_items || []; if (items.includes(itemName)) { setBogoForm({...bogoForm, included_items: items.filter((i: string) => i !== itemName)}); } else { setBogoForm({...bogoForm, included_items: [...items, itemName]}); } } else { const items = bundleForm.included_items || []; if (items.includes(itemName)) { setBundleForm({...bundleForm, included_items: items.filter((i: string) => i !== itemName)}); } else { setBundleForm({...bundleForm, included_items: [...items, itemName]}); } } };
  const toggleCatExpand = (catName: string) => { if(expandedCategories.includes(catName)) { setExpandedCategories(expandedCategories.filter(c => c !== catName)); } else { setExpandedCategories([...expandedCategories, catName]); } };
  const updateTemplate = (id: string, field: 'subject' | 'body', value: string) => { setEmailTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t)); };
  const saveTemplate = async () => { if (!selectedTemplate) return; const { error } = await supabase.from('cp_email_templates').upsert({ id: selectedTemplate.id, name: selectedTemplate.name, subject: selectedTemplate.subject, body: selectedTemplate.body, type: selectedTemplate.type, variables: selectedTemplate.variables }); if (!error) { alert('Template saved!'); } };
  const selectedTemplate = emailTemplates.find(t => t.id === selectedTemplateId);
  const filteredCustomers = customers.filter(c => (c.name || '').toLowerCase().includes(customerFilter.name.toLowerCase()) && (c.phone || '').includes(customerFilter.phone) && (c.address || '').toLowerCase().includes(customerFilter.postcode.toLowerCase()));
  const renderServiceSelector = (formType: 'bogo' | 'bundle', currentItems: string[]) => (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden"><div className="bg-gray-50 px-3 py-2 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">Included Items</div><div className="max-h-48 overflow-y-auto bg-white p-2">{categories.map(cat => { const catServices = services.filter(s => s.category === cat.name); if (catServices.length === 0) return null; const isExpanded = expandedCategories.includes(cat.name); return (<div key={cat.name} className="mb-1"><div onClick={() => toggleCatExpand(cat.name)} className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-1 rounded"><span className="font-bold text-sm text-gray-700">{cat.name}</span>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>{isExpanded && (<div className="pl-2 mt-1 space-y-1">{catServices.map(svc => (<div key={svc.name} className="flex justify-between items-center text-sm pl-2 border-l-2 border-gray-100"><span className="text-gray-600">{svc.name}</span><button onClick={() => togglePromoItem(formType, svc.name)} className={`w-10 h-5 rounded-full flex items-center transition-colors duration-200 px-1 ${currentItems.includes(svc.name) ? 'bg-trust-blue justify-end' : 'bg-gray-300 justify-start'}`}><div className="w-3 h-3 bg-white rounded-full shadow-sm" /></button></div>))}</div>)}</div>) })}</div><div className="bg-gray-50 px-3 py-1 text-xs text-gray-500 text-right border-t border-gray-200">{currentItems.length || 0} items selected</div></div>
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      const newServices: any[] = [];
      const newCategories = new Set<string>();

      const startIdx = lines[0]?.toLowerCase().includes('category') ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(',');
        if (cols.length >= 3) {
            const category = cols[0].trim().replace(/^"|"$/g, '');
            const name = cols[1].trim().replace(/^"|"$/g, '');
            const priceStr = cols[2].trim().replace(/^"|"$/g, '').replace(/[^0-9.]/g, '');
            const price = parseFloat(priceStr);

            if (category && name && !isNaN(price)) {
                newServices.push({ category, name, price });
                newCategories.add(category);
            }
        }
      }

      if (newServices.length > 0) {
        const categoryData = Array.from(newCategories).map((name, idx) => ({ name, sort_order: idx + 99 }));
        for (const cat of categoryData) {
             const { data: exist } = await supabase.from('cp_categories').select('id').eq('name', cat.name).single();
             if (!exist) await supabase.from('cp_categories').insert([cat]);
        }

        const { error } = await supabase.from('cp_services').insert(newServices);
        
        if (!error) {
          alert(`Imported ${newServices.length} services successfully.`);
          fetchServices();
          fetchCategories();
        } else {
          alert('Import failed: ' + error.message);
        }
      } else {
        alert('No valid rows found. CSV Format: Category,Name,Price');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  return (
    <div className="pt-28 pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-200 pb-4">
        <div><h1 className="font-heading font-bold text-3xl text-gray-900">Back Office</h1><p className="text-gray-600">Administrative Dashboard</p></div>
        <div className="flex items-center gap-2 mt-4 md:mt-0"><div className="bg-blue-50 text-trust-blue px-3 py-1 rounded-full text-xs font-bold uppercase">Admin Mode</div><button onClick={() => window.location.reload()} className="text-gray-400 hover:text-red-500 text-xs underline">Logout</button></div>
      </div>
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 inline-flex flex-wrap gap-y-2">
        <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><ShoppingBag size={16} /> Orders</button>
        <button onClick={() => setActiveTab('store')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'store' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Settings size={16} /> Store Details</button>
        <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'customers' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users size={16} /> Customers</button>
        <button onClick={() => setActiveTab('offers')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'offers' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Tag size={16} /> Offers & Loyalty</button>
        <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'schedule' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Calendar size={16} /> Schedule</button>
        <button onClick={() => setActiveTab('service')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'service' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Shirt size={16} /> Services</button>
        <button onClick={() => setActiveTab('marketing')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'marketing' ? 'bg-white text-trust-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Mail size={16} /> Marketing</button>
      </div>

      {activeTab === 'store' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in">
              <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20} className="text-trust-blue"/> Store Details (Invoice Settings)</h3><button onClick={() => handleSaveSettings()} className="bg-trust-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-trust-blue-hover transition flex items-center gap-2"><Save size={16} /> {saved ? 'Saved!' : 'Save Changes'}</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-1">Store Name</label><input type="text" className="w-full border rounded p-2" value={settings.store_name || ''} onChange={e => setSettings({...settings, store_name: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">VAT Number</label><input type="text" className="w-full border rounded p-2" value={settings.store_vat || ''} onChange={e => setSettings({...settings, store_vat: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Email Address (Order Copies)</label><input type="email" className="w-full border rounded p-2" value={settings.store_email || ''} onChange={e => setSettings({...settings, store_email: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label><input type="text" className="w-full border rounded p-2" value={settings.store_phone || ''} onChange={e => setSettings({...settings, store_phone: e.target.value})} /></div><div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">Store Address</label><textarea rows={3} className="w-full border rounded p-2" value={settings.store_address || ''} onChange={e => setSettings({...settings, store_address: e.target.value})} /></div><div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">Invoice Footer Text</label><textarea rows={2} className="w-full border rounded p-2" value={settings.invoice_footer || ''} onChange={e => setSettings({...settings, invoice_footer: e.target.value})} /></div></div>
          </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
           <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><ShoppingBag size={20} className="text-trust-blue"/> Order Management</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200"><tr><th className="px-4 py-3">Order #</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Prefs</th><th className="px-4 py-3">POS Ticket #</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Actions</th></tr></thead>
               <tbody className="divide-y divide-gray-100">
                 {orders.map(order => (
                   <tr key={order.id} className="hover:bg-gray-50 transition">
                     <td className="px-4 py-4 font-medium text-gray-900">#{order.readable_id}</td>
                     <td className="px-4 py-4"><div className="font-bold text-gray-800">{order.customer_name}</div><div className="text-xs text-gray-500">{order.customer_address}</div></td>
                     <td className="px-4 py-4">
                       {order.preferences && Object.keys(order.preferences).length > 0 ? (
                         <div className="group relative">
                           <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold cursor-help">Prefs</span>
                           <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded shadow-lg hidden group-hover:block z-50">
                             Starch: {order.preferences.starch}<br/>
                             Finish: {order.preferences.finish}<br/>
                             Care: {order.preferences.detergent}
                           </div>
                         </div>
                       ) : <span className="text-gray-300">-</span>}
                     </td>
                     <td className="px-4 py-4"><div className="flex items-center gap-1"><Ticket size={14} className="text-gray-400" /><input type="text" className="border border-gray-300 rounded px-2 py-1 text-xs w-24 focus:border-trust-blue outline-none" placeholder="Ticket ID" value={order.pos_ticket_id || ''} onChange={(e) => updatePosTicket(order.id, e.target.value)}/></div></td>
                     <td className="px-4 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{order.status}</span></td>
                     <td className="px-4 py-4"><select className="text-xs border border-gray-200 rounded p-1 bg-white focus:border-trust-blue outline-none" value={order.driver_id || ''} onChange={(e) => updateOrderDriver(order.id, e.target.value)}><option value="">-- Assign --</option>{drivers.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}</select></td>
                     <td className="px-4 py-4"><div className="flex gap-1">{['pending', 'collected', 'cleaning', 'completed'].map(status => (<button key={status} onClick={() => updateOrderStatus(order.id, status)} title={`Mark as ${status}`} className={`w-6 h-6 flex items-center justify-center rounded border ${order.status === status ? 'bg-trust-blue text-white border-trust-blue' : 'bg-white text-gray-400 hover:border-gray-400'}`}>{status.charAt(0).toUpperCase()}</button>))}</div></td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {orders.length === 0 && <div className="p-8 text-center text-gray-500">No orders found.</div>}
           </div>
        </div>
      )}

      {/* Other tabs */}
      {activeTab === 'customers' && ( <div className="space-y-6"><div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-trust-blue"/> Customer Account Management</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><input type="text" placeholder="Filter by Name..." value={customerFilter.name} onChange={e => setCustomerFilter({...customerFilter, name: e.target.value})} className="border p-2 rounded bg-gray-50 text-sm" /><input type="text" placeholder="Filter by Phone..." value={customerFilter.phone} onChange={e => setCustomerFilter({...customerFilter, phone: e.target.value})} className="border p-2 rounded bg-gray-50 text-sm" /><input type="text" placeholder="Filter by Postcode..." value={customerFilter.postcode} onChange={e => setCustomerFilter({...customerFilter, postcode: e.target.value})} className="border p-2 rounded bg-gray-50 text-sm" /></div></div><div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center"><h4 className="font-bold text-gray-700">Customer List ({filteredCustomers.length})</h4><button onClick={fetchCustomers} className="text-xs text-trust-blue hover:underline">Refresh List</button></div><table className="w-full text-sm text-left"><thead className="text-gray-500 font-medium border-b border-gray-200"><tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Phone</th><th className="px-6 py-3">Email</th><th className="px-6 py-3">Loyalty Pts</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredCustomers.map(customer => (<tr key={customer.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900">{editingCustomer?.id === customer.id ? (<input className="border rounded p-1 w-full" value={editingCustomer.name} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} />) : customer.name}</td><td className="px-6 py-4 text-gray-600">{editingCustomer?.id === customer.id ? (<input className="border rounded p-1 w-full" value={editingCustomer.phone} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} />) : customer.phone}</td><td className="px-6 py-4 text-gray-600">{editingCustomer?.id === customer.id ? (<input className="border rounded p-1 w-full" value={editingCustomer.email} onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})} />) : customer.email}</td><td className="px-6 py-4"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">{customer.loyalty_points || 0} pts</span></td><td className="px-6 py-4 text-right">{editingCustomer?.id === customer.id ? (<div className="flex justify-end gap-2"><button onClick={saveCustomer} className="text-green-600 hover:text-green-800 font-bold text-xs bg-green-50 px-3 py-1 rounded">Save</button><button onClick={() => setEditingCustomer(null)} className="text-gray-500 hover:text-gray-700 text-xs px-2">Cancel</button></div>) : (<button onClick={() => setEditingCustomer(customer)} className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs font-semibold transition"><Edit3 size={12} /> Edit</button>)}</td></tr>))}</tbody></table></div></div> )}
      {activeTab === 'offers' && ( <div className="space-y-6 animate-fade-in"><div className="flex items-center gap-2 mb-4"><Tag size={24} className="text-trust-blue" /><h2 className="text-2xl font-bold">Special Offers & Promotions</h2></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative flex flex-col"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">Buy X Get Y Free</h3></div></div><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-xs text-gray-500 mb-1">Buy Items</label><input type="number" className="w-full border rounded bg-gray-50 p-2" value={bogoForm.buy_qty} onChange={e => setBogoForm({...bogoForm, buy_qty: parseInt(e.target.value)})} /></div><div><label className="block text-xs text-gray-500 mb-1">Get Free</label><input type="number" className="w-full border rounded bg-gray-50 p-2" value={bogoForm.get_qty} onChange={e => setBogoForm({...bogoForm, get_qty: parseInt(e.target.value)})} /></div></div>{renderServiceSelector('bogo', bogoForm.included_items)}<button onClick={saveBogoPromotion} className="w-full bg-trust-blue text-white py-2 rounded-lg font-bold hover:bg-trust-blue-hover mt-4">Save BOGO Deal</button>{promotions.filter(p => p.type === 'bogo').length > 0 && (<div className="mt-4 pt-4 border-t"><h4 className="text-xs font-bold text-gray-500 mb-2">Active BOGO Deals</h4>{promotions.filter(p => p.type === 'bogo').map(p => (<div key={p.id} className="flex justify-between items-center text-sm mb-2 bg-gray-50 p-2 rounded"><div><span>Buy {p.buy_qty} Get {p.get_qty} Free</span><div className="text-xs text-gray-500 truncate max-w-[200px]">{p.included_items?.join(', ')}</div></div><button onClick={() => deletePromo(p.id)} className="text-red-500 text-xs hover:underline">Delete</button></div>))}</div>)}</div><div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative flex flex-col"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2"><h3 className="font-bold text-gray-900">Bundle Deal</h3></div></div><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-xs text-gray-500 mb-1">Bundle Qty</label><input type="number" className="w-full border rounded bg-gray-50 p-2" value={bundleForm.bundle_qty} onChange={e => setBundleForm({...bundleForm, bundle_qty: parseInt(e.target.value)})} /></div><div><label className="block text-xs text-gray-500 mb-1">Fixed Price (£)</label><input type="number" className="w-full border rounded bg-gray-50 p-2" value={bundleForm.bundle_price} onChange={e => setBundleForm({...bundleForm, bundle_price: parseFloat(e.target.value)})} /></div></div>{renderServiceSelector('bundle', bundleForm.included_items)}<button onClick={saveBundlePromotion} className="w-full bg-trust-blue text-white py-2 rounded-lg font-bold hover:bg-trust-blue-hover mt-4">Save Bundle</button>{promotions.filter(p => p.type === 'bundle').length > 0 && (<div className="mt-4 pt-4 border-t"><h4 className="text-xs font-bold text-gray-500 mb-2">Active Bundle Deals</h4>{promotions.filter(p => p.type === 'bundle').map(p => (<div key={p.id} className="flex justify-between items-center text-sm mb-2 bg-gray-50 p-2 rounded"><div><span>{p.bundle_qty} items for £{p.bundle_price}</span><div className="text-xs text-gray-500 truncate max-w-[200px]">{p.included_items?.join(', ')}</div></div><button onClick={() => deletePromo(p.id)} className="text-red-500 text-xs hover:underline">Delete</button></div>))}</div>)}</div></div><div className="my-8 border-t border-gray-200 pt-8"><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Gift size={20} className="text-purple-600" /> Spend & Get Reward (Loyalty)</h3><div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"><div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Points per £1 Spend</label><input type="number" value={settings.points_per_pound || 1} onChange={e => setSettings({...settings, points_per_pound: e.target.value})} className="w-full border rounded p-2" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Point Value (Pence)</label><input type="number" value={settings.point_value_pence || 5} onChange={e => setSettings({...settings, point_value_pence: e.target.value})} className="w-full border rounded p-2" /><p className="text-xs text-gray-400 mt-1">Example: 5p = 100 points is £5 off.</p></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Min Points to Redeem</label><input type="number" value={settings.min_points_redemption || 100} onChange={e => setSettings({...settings, min_points_redemption: e.target.value})} className="w-full border rounded p-2" /></div></div><div className="flex justify-end"><button onClick={() => handleSaveSettings()} className="bg-trust-blue text-white px-6 py-2 rounded-lg font-bold">Save Loyalty Settings</button></div></div></div></div> )}
      {activeTab === 'schedule' && ( <div className="space-y-6 animate-fade-in"><div className="flex items-center gap-2 mb-4"><Calendar size={24} className="text-trust-blue" /><h2 className="text-2xl font-bold">Online Order Scheduling</h2></div><div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="bg-gray-100 p-1 rounded-lg inline-flex mb-6 text-sm font-semibold text-gray-600"><div className="bg-white shadow-sm px-4 py-2 rounded text-gray-900">Collection Schedule</div><div className="px-4 py-2 opacity-50 cursor-not-allowed">Delivery Schedule</div></div><div className="space-y-4">{DAYS.map(day => { const isActive = settings[`day_active_${day}`] === 'true'; const daySlots = availableSlots.filter(s => s.day === day); return (<div key={day} className={`border rounded-xl transition-all ${isActive ? 'border-gray-300 bg-white' : 'border-gray-100 bg-gray-50'}`}><div className="flex items-center justify-between p-4"><span className={`font-bold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{day}</span><button onClick={() => toggleDay(day)} className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${isActive ? 'bg-trust-blue' : 'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-0'}`} /></button></div>{isActive && (<div className="px-4 pb-4 border-t border-gray-100 pt-4 animate-fade-in"><div className="flex flex-wrap gap-2 mb-3">{daySlots.map(slot => (<div key={slot.id} className="bg-blue-50 text-trust-blue px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-blue-100">{slot.label} - {getNextDate(slot.day)}<button onClick={() => deleteSlot(slot.id)} className="text-blue-400 hover:text-red-500 ml-2"><X size={14} /></button></div>))}{daySlots.length === 0 && <span className="text-xs text-gray-400 italic py-1">No slots added.</span>}</div><div className="flex items-center gap-2 mt-2"><input type="text" placeholder="e.g. 09:00 - 12:00" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40 focus:ring-1 focus:ring-trust-blue outline-none" /><button onClick={() => addSlotToDay(day)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition"><Plus size={14} /> Add Time Slot</button></div></div>)}</div>); })}</div></div></div> )}
      
      {activeTab === 'service' && (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
               <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Upload size={20} className="text-trust-blue" /> Import Price List</h3>
               <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center">
                   <p className="text-sm text-gray-600 mb-4">Upload a CSV file to bulk update products, prices, and categories.</p>
                   <label className="inline-flex items-center gap-2 bg-white border border-trust-blue text-trust-blue px-6 py-2 rounded-lg font-bold cursor-pointer hover:bg-blue-50 transition">
                       <Upload size={18} /> Select CSV File
                       <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                   </label>
               </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50"><h4 className="font-bold text-gray-700">Current Services List</h4></div>
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 sticky top-0">
                            <tr><th className="px-6 py-3">Category</th><th className="px-6 py-3">Service Name</th><th className="px-6 py-3 text-right">Price</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {services.length === 0 && (<tr><td colSpan={3} className="p-6 text-center text-gray-500">No services found.</td></tr>)}
                            {services.map(svc => (
                                <tr key={svc.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-medium text-gray-500">{svc.category}</td>
                                    <td className="px-6 py-3 text-gray-900">{svc.name}</td>
                                    <td className="px-6 py-3 text-right font-bold">
                                        £{(() => {
                                            const p = parseFloat(String(svc.price).replace(/[^0-9.]/g, ''));
                                            return isNaN(p) ? '0.00' : p.toFixed(2);
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'marketing' && ( <div className="space-y-6 animate-fade-in"><div className="flex items-center gap-2 mb-4"><Mail size={24} className="text-trust-blue" /><h2 className="text-2xl font-bold">Email Marketing & Templates</h2></div><div className="flex flex-col md:flex-row gap-6 h-[600px]"><div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"><div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700">Templates</div><div className="flex-1 overflow-y-auto">{emailTemplates.length === 0 && <p className="p-4 text-xs text-gray-400">No templates found. Check database.</p>}{emailTemplates.map(template => (<div key={template.id} onClick={() => setSelectedTemplateId(template.id)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${selectedTemplateId === template.id ? 'bg-blue-50 border-l-4 border-l-trust-blue' : ''}`}><div className="flex justify-between items-start mb-1"><h4 className="font-bold text-gray-800 text-sm">{template.name}</h4><span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${template.type === 'marketing' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{template.type}</span></div><p className="text-xs text-gray-500 truncate">{template.subject}</p></div>))}</div><div className="p-4 bg-gray-50 border-t border-gray-200"><button onClick={() => alert("Create New functionality would go here.")} className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 flex items-center justify-center gap-2"><Plus size={16} /> New Template</button></div></div><div className="w-full md:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">{selectedTemplate ? (<><div className="p-6 border-b border-gray-100"><div className="flex justify-between items-start mb-4"><div><h3 className="font-bold text-xl text-gray-900">{selectedTemplate.name}</h3><p className="text-sm text-gray-500">Edit the content below.</p></div>{selectedTemplate.type === 'marketing' && (<button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Send size={16} /> Send Campaign</button>)}</div><div className="space-y-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject Line</label><input type="text" value={selectedTemplate.subject} onChange={(e) => updateTemplate(selectedTemplate.id, 'subject', e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-trust-blue outline-none"/></div></div></div><div className="flex-1 p-6 flex flex-col"><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-500 uppercase">Email Body</label><div className="flex gap-2">{selectedTemplate.variables && selectedTemplate.variables.map(v => (<button key={v} title="Click to copy" onClick={() => navigator.clipboard.writeText(`{{${v}}}`)} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300 font-mono">{`{{${v}}}`}</button>))}</div></div><textarea className="flex-1 w-full border border-gray-300 rounded-lg p-4 font-mono text-sm focus:ring-2 focus:ring-trust-blue outline-none resize-none leading-relaxed" value={selectedTemplate.body} onChange={(e) => updateTemplate(selectedTemplate.id, 'body', e.target.value)}/></div><div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center"><button className="text-gray-500 text-sm hover:text-gray-700 font-medium">Send Test Email</button><button onClick={saveTemplate} className="bg-trust-blue text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-trust-blue-hover flex items-center gap-2"><Save size={16} /> Save Changes</button></div></>) : (<div className="flex-1 flex flex-col items-center justify-center text-gray-400"><FileText size={48} className="mb-4 opacity-20" /><p>Select a template to edit</p></div>)}</div></div></div> )}
      {activeTab === 'reports' && <div className="text-center py-20 text-gray-500">Reports module coming soon...</div>}
    </div>
  );
};

const BookingPage: React.FC<{
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  availableSlots: TimeSlot[];
  currentUser: any; 
  onLoginSuccess: (user: any) => void;
  setPage: (page: Page) => void;
}> = ({ cart, setCart, availableSlots, currentUser, onLoginSuccess, setPage }) => {
    const [step, setStep] = useState(1);
    const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [recurring, setRecurring] = useState<'none' | 'weekly' | '2weekly'>('none');
    const [marketingOptIn, setMarketingOptIn] = useState(false);
    const [createAccount, setCreateAccount] = useState(false);
    const [accountPassword, setAccountPassword] = useState('');
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [services, setServices] = useState<ServiceProduct[]>([]);
    const [expandedCats, setExpandedCats] = useState<string[]>([]);
    const [pointsBalance, setPointsBalance] = useState(0);
    const [redeemPoints, setRedeemPoints] = useState(false);
    const [promotions, setPromotions] = useState<Promotion[]>([]);

    useEffect(() => {
      let mounted = true;
      const loadBookingData = async () => {
        try {
            const { data: cats } = await supabase.from('cp_categories').select('*').order('sort_order', { ascending: true });
            if (mounted && cats) {
                setCategories(cats);
                if(cats.length > 0) setExpandedCats([cats[0].name]);
            }
            const { data: svcs } = await supabase.from('cp_services').select('*').order('category');
            if (mounted && svcs) setServices(svcs);
            const { data: promos } = await supabase.from('cp_promotions').select('*').eq('active', true);
            if (mounted && promos) setPromotions(promos as Promotion[]);
        } catch (error) { console.error(error); } 
        finally { if (mounted) setDataLoading(false); }
      };
      loadBookingData();
      return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (currentUser) {
            setCustomer(prev => ({
                ...prev,
                name: currentUser.name || '',
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                address: currentUser.address || '',
                notes: currentUser.notes || ''
            }));
            if (currentUser.email && currentUser.loyalty_points) setPointsBalance(currentUser.loyalty_points);
        }
    }, [currentUser]);

    const calculateTotals = () => {
        let subtotal = 0; let discount = 0; const pointsPerPound = 1; const pointValuePence = 5;
        cart.forEach(item => { const price = parseFloat(item.price); if (!isNaN(price)) { subtotal += price * item.quantity; } });
        promotions.forEach(promo => {
            const eligibleItems = cart.filter(cartItem => promo.included_items && promo.included_items.includes(cartItem.name));
            if (eligibleItems.length === 0) return;
            let itemsPool: {price: number}[] = [];
            eligibleItems.forEach(item => { for(let i=0; i<item.quantity; i++) itemsPool.push({ price: parseFloat(item.price) }); });
            if (promo.type === 'bogo') {
                const setSize = promo.buy_qty + promo.get_qty;
                const totalItems = itemsPool.length;
                const numSets = Math.floor(totalItems / setSize);
                if (numSets > 0) { itemsPool.sort((a, b) => a.price - b.price); let freeCount = numSets * promo.get_qty; for (let i = 0; i < freeCount; i++) { discount += itemsPool[i].price; } }
            } else if (promo.type === 'bundle') {
                const bundleQty = promo.bundle_qty;
                const totalItems = itemsPool.length;
                const numBundles = Math.floor(totalItems / bundleQty);
                if (numBundles > 0) { itemsPool.sort((a, b) => b.price - a.price); let standardPriceForBundledItems = 0; const bundledItemsCount = numBundles * bundleQty; for (let i = 0; i < bundledItemsCount; i++) { standardPriceForBundledItems += itemsPool[i].price; } const bundleCost = numBundles * promo.bundle_price; const saving = standardPriceForBundledItems - bundleCost; if (saving > 0) discount += saving; }
            }
        });
        const totalBeforePoints = subtotal - discount;
        let pointsDiscount = 0;
        if (redeemPoints && pointsBalance >= 100) { pointsDiscount = (pointsBalance * pointValuePence) / 100; if (pointsDiscount > totalBeforePoints) pointsDiscount = totalBeforePoints; }
        const finalTotal = totalBeforePoints - pointsDiscount;
        const potential = Math.floor(finalTotal * pointsPerPound);
        return { subtotal, discount, pointsDiscount, finalTotal, potential };
    };
    const totals = calculateTotals();

    const addToCart = (item: ServiceProduct) => { const existing = cart.find(i => i.name === item.name); if (existing) { setCart(cart.map(i => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i)); } else { setCart([...cart, { name: item.name, price: (item.price || 0).toString(), quantity: 1, note: '' }]); } };
    const updateQuantity = (itemName: string, delta: number) => { const existing = cart.find(i => i.name === itemName); if (!existing) return; const newQty = existing.quantity + delta; if (newQty <= 0) setCart(cart.filter(i => i.name !== itemName)); else setCart(cart.map(i => i.name === itemName ? { ...i, quantity: newQty } : i)); };
    const updateNote = (itemName: string, note: string) => setCart(cart.map(i => i.name === itemName ? { ...i, note } : i));
    const removeFromCart = (itemName: string) => setCart(cart.filter(i => i.name !== itemName));
    const toggleCat = (catName: string) => setExpandedCats(expandedCats.includes(catName) ? expandedCats.filter(c => c !== catName) : [...expandedCats, catName]);
    const checkLoyalty = async () => { if (!customer.email) return; const { data } = await supabase.from('cp_customers').select('loyalty_points').eq('email', customer.email).single(); if (data) setPointsBalance(data.loyalty_points); else setPointsBalance(0); };

    const submitOrder = async () => {
        if(!customer.name || !customer.phone || !customer.address || !selectedSlot) { alert("Please fill in all details and select a collection slot."); return; }
        if (createAccount && !accountPassword) { alert("Please enter a password to create your account."); return; }
        setLoading(true);
        
        let storeEmail = '';
        const { data: settings } = await supabase.from('cp_app_settings').select('value').eq('key', 'store_email').single();
        if (settings) storeEmail = settings.value;
        const readableId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        let userPreferences = {};
        if (currentUser) {
            userPreferences = {
                starch: currentUser.starch_level,
                finish: currentUser.finish_style,
                trouser_crease: currentUser.trouser_crease,
                auth_repairs: currentUser.auth_repairs,
                detergent: currentUser.detergent,
                no_plastic: currentUser.no_plastic,
                recycle_hangers: currentUser.recycle_hangers
            };
        }

        const { error } = await supabase.from('cp_orders').insert([{ 
            readable_id: readableId, 
            customer_name: customer.name, 
            customer_email: customer.email, 
            customer_phone: customer.phone, 
            customer_address: customer.address, 
            preferred_slot_id: selectedSlot, 
            items: cart, 
            status: 'pending', 
            points_earned: totals.potential, 
            points_redeemed: redeemPoints ? pointsBalance : 0, 
            discount_amount: totals.discount + totals.pointsDiscount, 
            recurring_frequency: recurring, 
            marketing_opt_in: marketingOptIn, 
            create_account_requested: createAccount,
            preferences: userPreferences
        }]);
        
        if (!error) {
            let newBalance = pointsBalance + totals.potential;
            if (redeemPoints) newBalance -= pointsBalance; 
            
            const customerData: any = { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address, loyalty_points: newBalance, notes: customer.notes };
            if (createAccount && accountPassword) { customerData.password = accountPassword; }
            await supabase.from('cp_customers').upsert(customerData, { onConflict: 'email' });

            if (!currentUser) {
                onLoginSuccess(customerData); 
            }

            await sendOrderConfirmation({ name: customer.name, email: customer.email, orderId: readableId, items: cart, storeEmail: storeEmail });
            
            setCart([]); 
            setPage('customer-portal'); 
        } else { alert("Order submission failed: " + error.message); }
        setLoading(false);
    };

    if (dataLoading) { return <div className="pt-32 pb-20 text-center flex justify-center"><Loader2 className="animate-spin text-trust-blue" size={48} /></div>; }

    return (
        <div className="pt-28 pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in">
             <div className="flex justify-center mb-12"><div className="flex items-center"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-trust-blue text-white' : 'bg-gray-200 text-gray-500'}`}>1</div><div className={`w-16 h-1 ${step >= 2 ? 'bg-trust-blue' : 'bg-gray-200'}`} /><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-trust-blue text-white' : 'bg-gray-200 text-gray-500'}`}>2</div><div className={`w-16 h-1 ${step >= 3 ? 'bg-trust-blue' : 'bg-gray-200'}`} /><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-trust-blue text-white' : 'bg-gray-200 text-gray-500'}`}>3</div></div></div>

             {step === 1 && (
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     <div className="lg:col-span-2 space-y-4">
                         <h2 className="font-bold text-2xl mb-4">Select Items</h2>
                         {categories.map(cat => {
                            const catServices = services.filter(s => s.category === cat.name);
                            if (catServices.length === 0) return null;
                            const isExpanded = expandedCats.includes(cat.name);
                            return (
                                <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <button onClick={() => toggleCat(cat.name)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"><span className="font-bold text-gray-800 capitalize">{cat.name}</span>{isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                                    {isExpanded && (<div className="divide-y divide-gray-100">{catServices.map(svc => (<div key={svc.id} className="p-4 flex justify-between items-center hover:bg-blue-50/50 transition"><div><div className="font-medium text-gray-900">{svc.name}</div><div className="text-sm font-bold text-trust-blue">£{Number(svc.price || 0).toFixed(2)}</div></div><button onClick={() => addToCart(svc)} className="bg-white border border-trust-blue text-trust-blue p-1.5 rounded-full hover:bg-trust-blue hover:text-white transition"><Plus size={18} /></button></div>))}</div>)}
                                </div>
                            );
                         })}
                     </div>
                     <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-fit sticky top-24">
                         <div className="flex justify-between items-center mb-4 border-b pb-2">
                             <h3 className="font-bold text-xl">Your Basket</h3>
                             {cart.length > 0 && (
                                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
                                    <Trash2 size={12} /> Empty Cart
                                </button>
                             )}
                         </div>
                         {cart.length === 0 ? <p className="text-gray-500 text-sm mb-6">No items selected.</p> : (
                             <div className="space-y-4 mb-6">
                                 {cart.map(item => (
                                     <div key={item.name} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                         <div className="flex justify-between items-start mb-2"><span className="font-semibold text-sm">{item.name}</span><span className="font-bold text-sm">£{(parseFloat(item.price) * item.quantity).toFixed(2)}</span></div>
                                         <div className="flex items-center justify-between gap-2"><div className="flex items-center border border-gray-300 rounded-lg overflow-hidden"><button onClick={() => updateQuantity(item.name, -1)} className="px-2 py-1 bg-gray-50 hover:bg-gray-200 text-gray-600"><Minus size={14}/></button><span className="px-2 py-1 text-sm font-bold w-8 text-center">{item.quantity}</span><button onClick={() => updateQuantity(item.name, 1)} className="px-2 py-1 bg-gray-50 hover:bg-gray-200 text-gray-600"><Plus size={14}/></button></div><input type="text" placeholder="Add note..." value={item.note || ''} onChange={(e) => updateNote(item.name, e.target.value)} className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50" /><button onClick={() => removeFromCart(item.name)} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button></div>
                                     </div>
                                 ))}
                                 <div className="flex justify-between items-center text-lg font-bold border-t pt-4 mt-2"><span>Subtotal</span><span>£{totals.subtotal.toFixed(2)}</span></div>
                                 {totals.discount > 0 && <div className="flex justify-between items-center text-sm font-bold text-green-600"><span>Offer Discount</span><span>-£{totals.discount.toFixed(2)}</span></div>}
                                 <div className="flex justify-between items-center text-lg font-bold border-t pt-4 mt-2 text-trust-blue"><span>Total</span><span>£{totals.finalTotal.toFixed(2)}</span></div>
                             </div>
                         )}
                         <button onClick={() => setStep(2)} disabled={cart.length === 0} className="w-full bg-trust-blue text-white py-3 rounded-lg font-bold hover:bg-trust-blue-hover transition disabled:opacity-50 disabled:cursor-not-allowed">Select Collection Slot</button>
                     </div>
                 </div>
             )}

             {step === 2 && (
                 <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                     <h2 className="font-bold text-2xl mb-6">Select Collection Slot</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">{availableSlots.length > 0 ? availableSlots.map(slot => (<button key={slot.id} onClick={() => setSelectedSlot(slot.id)} className={`flex flex-col p-4 rounded-xl border-2 text-left transition relative overflow-hidden group ${selectedSlot === slot.id ? 'border-trust-blue bg-blue-50 text-trust-blue shadow-md' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'}`}><div className="font-bold text-lg mb-1">{slot.day}</div><div className="flex items-center gap-2 text-sm opacity-80"><Clock size={16}/> {slot.label} - {getNextDate(slot.day)}</div>{selectedSlot === slot.id && <div className="absolute top-2 right-2 bg-trust-blue text-white rounded-full p-1"><Check size={12} /></div>}</button>)) : <p className="text-gray-500 col-span-2 text-center py-4 bg-gray-50 rounded-lg">No slots available.</p>}<button onClick={() => setSelectedSlot('anytime')} className={`flex flex-col p-4 rounded-xl border-2 text-left transition relative overflow-hidden group ${selectedSlot === 'anytime' ? 'border-trust-blue bg-blue-50 text-trust-blue shadow-md' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'}`}><div className="font-bold text-lg mb-1">Anytime</div><div className="flex items-center gap-2 text-sm opacity-80"><Clock size={16}/> Flexible (8am - 5pm)</div>{selectedSlot === 'anytime' && <div className="absolute top-2 right-2 bg-trust-blue text-white rounded-full p-1"><Check size={12} /></div>}</button></div>
                     <div className="flex justify-between border-t pt-6"><button onClick={() => setStep(1)} className="text-gray-500 font-bold hover:text-gray-700">Back</button><button onClick={() => setStep(3)} disabled={!selectedSlot} className="bg-trust-blue text-white px-8 py-3 rounded-lg font-bold hover:bg-trust-blue-hover disabled:opacity-50 flex items-center gap-2">Enter Details</button></div>
                 </div>
             )}

             {step === 3 && (
                 <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                     <h2 className="font-bold text-2xl mb-6">Collection Details</h2>
                     <div className="space-y-6">
                         <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label><input type="text" className="w-full border rounded-lg p-3" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Phone</label><input type="tel" className="w-full border rounded-lg p-3" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} /></div></div>
                         <div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" className="w-full border rounded-lg p-3" value={customer.email} onBlur={checkLoyalty} onChange={e => setCustomer({...customer, email: e.target.value})} /></div>
                         <div><label className="block text-sm font-bold text-gray-700 mb-1">Collection Address</label><textarea className="w-full border rounded-lg p-3" rows={3} value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})}></textarea></div>
                         <div><label className="block text-sm font-bold text-gray-700 mb-1">Delivery Notes / Gate Code</label><textarea className="w-full border rounded-lg p-3" rows={2} value={customer.notes} placeholder="e.g. Gate code 1234" onChange={e => setCustomer({...customer, notes: e.target.value})}></textarea></div>
                         <div className="space-y-4 pt-4 border-t border-gray-100">
                             <div><span className="block text-sm font-bold text-gray-700 mb-2">Recurring?</span><div className="flex gap-2"><button onClick={() => setRecurring('none')} className={`flex-1 py-2 rounded-lg text-sm border ${recurring === 'none' ? 'bg-blue-50 border-trust-blue text-trust-blue' : 'bg-white'}`}>One-off</button><button onClick={() => setRecurring('weekly')} className={`flex-1 py-2 rounded-lg text-sm border ${recurring === 'weekly' ? 'bg-blue-50 border-trust-blue text-trust-blue' : 'bg-white'}`}>Weekly</button></div></div>
                             {!currentUser && (<div className="space-y-3"><label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition"><input type="checkbox" className="w-5 h-5 text-trust-blue rounded" checked={createAccount} onChange={e => setCreateAccount(e.target.checked)} /><div className="text-sm text-gray-700"><UserPlus size={16} className="inline mr-2" />Create an account</div></label>{createAccount && (<div className="ml-8 p-3 bg-blue-50 rounded-lg border border-blue-100 animate-fade-in"><label className="block text-xs font-bold text-gray-700 mb-1">Choose a Password</label><input type="password" className="w-full border rounded p-2 text-sm" placeholder="Enter password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} /></div>)}</div>)}
                         </div>
                         <div className="flex justify-between mt-8 pt-6 border-t"><button onClick={() => setStep(2)} className="text-gray-500 font-bold hover:text-gray-700">Back</button><button onClick={submitOrder} disabled={!customer.name || !customer.phone || !customer.address} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 shadow-lg flex items-center gap-2">{loading && <Loader2 className="animate-spin" size={18} />} Confirm Booking</button></div>
                     </div>
                 </div>
             )}
        </div>
    );
};

// --- New Page Components ---

const HomePage: React.FC<{ setPage: (p: Page) => void }> = ({ setPage }) => (
  <div className="animate-fade-in">
    <div className="relative bg-gray-900 text-white py-20 px-4">
      <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1545173168-9f1947eebb8f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center" />
      <div className="relative max-w-4xl mx-auto text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">Professional Care for Your Clothes</h1>
        <p className="text-xl text-gray-200 mb-8">Winchester's premier dry cleaning and laundry service. Eco-friendly, reliable, and delivered to your door.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button onClick={() => setPage('booking')} className="bg-trust-blue hover:bg-trust-blue-hover text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center justify-center gap-2">Book Now <ArrowRight size={20}/></button>
          <button onClick={() => setPage('services')} className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-3 rounded-full font-bold text-lg shadow-lg">View Services</button>
        </div>
      </div>
    </div>
    <div className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="p-6">
          <div className="w-16 h-16 bg-blue-50 text-trust-blue rounded-full flex items-center justify-center mx-auto mb-4"><Truck size={32}/></div>
          <h3 className="text-xl font-bold mb-2">Free Collection & Delivery</h3>
          <p className="text-gray-600">We pick up and deliver directly to your doorstep. Convenient slots available.</p>
        </div>
        <div className="p-6">
          <div className="w-16 h-16 bg-green-50 text-eco-green rounded-full flex items-center justify-center mx-auto mb-4"><Leaf size={32}/></div>
          <h3 className="text-xl font-bold mb-2">Eco-Friendly Cleaning</h3>
          <p className="text-gray-600">Advanced wet cleaning technology that is tough on stains but gentle on the planet.</p>
        </div>
        <div className="p-6">
           <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Sparkles size={32}/></div>
           <h3 className="text-xl font-bold mb-2">Quality Guaranteed</h3>
           <p className="text-gray-600">Expert care for your garments with attention to detail and hand finishing.</p>
        </div>
      </div>
    </div>
  </div>
);

const ServicesPage: React.FC = () => (
  <div className="pt-28 pb-20 max-w-4xl mx-auto px-4 animate-fade-in">
    <h1 className="text-3xl font-bold text-center mb-8">Services & Pricing</h1>
    <div className="grid md:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-4 text-trust-blue flex items-center gap-2"><Shirt size={20}/> Dry Cleaning</h3>
        <ul className="space-y-3">
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>2 Piece Suit</span><span className="font-bold">£14.50</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Trousers</span><span className="font-bold">£7.50</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Jacket</span><span className="font-bold">£8.50</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Dress</span><span className="font-bold">from £12.50</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Coat</span><span className="font-bold">£12.95</span></li>
        </ul>
      </div>
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-4 text-trust-blue flex items-center gap-2"><Droplet size={20}/> Laundry</h3>
        <ul className="space-y-3">
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Shirt (Hung)</span><span className="font-bold">£2.50</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Shirt (Folded)</span><span className="font-bold">£3.00</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Double Bed Set</span><span className="font-bold">£18.00</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Duvet (Double)</span><span className="font-bold">£22.00</span></li>
          <li className="flex justify-between border-b border-gray-50 pb-2"><span>Service Wash (per kg)</span><span className="font-bold">£4.50</span></li>
        </ul>
      </div>
    </div>
  </div>
);

const ContactPage: React.FC = () => (
  <div className="pt-28 pb-20 max-w-4xl mx-auto px-4 animate-fade-in">
    <h1 className="text-3xl font-bold text-center mb-12">Contact Us</h1>
    <div className="grid md:grid-cols-3 gap-8 text-center">
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <MapPin className="w-8 h-8 mx-auto text-trust-blue mb-4"/>
        <h3 className="font-bold mb-2">Visit Us</h3>
        <p className="text-gray-600">67 Stoney Ln, Weeke<br/>Winchester, SO22 6EW</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <Phone className="w-8 h-8 mx-auto text-trust-blue mb-4"/>
        <h3 className="font-bold mb-2">Call Us</h3>
        <p className="text-gray-600">01962 861998</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <Clock className="w-8 h-8 mx-auto text-trust-blue mb-4"/>
        <h3 className="font-bold mb-2">Opening Hours</h3>
        <p className="text-gray-600">Mon - Sat: 8:30 - 17:30<br/>Sun: Closed</p>
      </div>
    </div>
  </div>
);

const TrackOrderPage: React.FC = () => (
    <div className="pt-32 pb-20 max-w-md mx-auto px-4 animate-fade-in text-center">
        <h1 className="font-bold text-3xl mb-6">Track Your Order</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="mb-4">
                <label className="block text-left text-sm font-bold text-gray-700 mb-1">Order Number / Ticket ID</label>
                <input type="text" placeholder="e.g. #1234 or Ticket 5092" className="w-full border rounded-lg p-3"/>
            </div>
            <button className="w-full bg-trust-blue text-white font-bold py-3 rounded-lg hover:bg-trust-blue-hover transition">Track Status</button>
        </div>
    </div>
);

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);
  const [staffLoginType, setStaffLoginType] = useState<'admin' | 'driver' | null>(null);
  const [isCustomerLoginOpen, setIsCustomerLoginOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'customer' | 'admin' | 'driver' | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([
     { id: '1', day: 'Monday', label: '09:00 - 12:00', active: true },
     { id: '2', day: 'Tuesday', label: '09:00 - 12:00', active: true },
     { id: '3', day: 'Wednesday', label: '09:00 - 12:00', active: true },
     { id: '4', day: 'Thursday', label: '09:00 - 12:00', active: true },
     { id: '5', day: 'Friday', label: '09:00 - 12:00', active: true },
  ]);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);

  const handleStaffLogin = (type: 'admin' | 'driver') => { setStaffLoginType(type); setIsStaffLoginOpen(true); };
  const handleStaffLoginSuccess = () => { setIsStaffLoginOpen(false); setUserRole(staffLoginType); setUser({ name: staffLoginType === 'admin' ? 'Store Admin' : 'Driver', role: staffLoginType }); setPage(staffLoginType === 'admin' ? 'back-office' : 'driver-portal' as Page); };
  const handleCustomerLoginSuccess = (customer: any) => { setUser(customer); setUserRole('customer'); setIsCustomerLoginOpen(false); };
  const handleLogout = () => { setUser(null); setUserRole(null); setPage('home'); };
  const setPage = (page: Page) => { window.scrollTo(0, 0); setCurrentPage(page); };
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Header currentPage={currentPage} setPage={setPage} cartCount={cartCount} onLoginClick={() => setIsCustomerLoginOpen(true)} isLoggedIn={!!user} onLogout={handleLogout} />
      <main>
        {currentPage === 'home' && <HomePage setPage={setPage} />}
        {currentPage === 'services' && <ServicesPage />}
        {currentPage === 'contact' && <ContactPage />}
        {currentPage === 'track-order' && <TrackOrderPage />}
        {currentPage === 'booking' && <BookingPage cart={cart} setCart={setCart} availableSlots={availableSlots} currentUser={userRole === 'customer' ? user : null} onLoginSuccess={handleCustomerLoginSuccess} setPage={setPage} />}
        {currentPage === 'customer-portal' && userRole === 'customer' && <CustomerPortalPage user={user} onUpdateUser={setUser} />}
        {currentPage === 'back-office' && userRole === 'admin' && <BackOfficePage availableSlots={availableSlots} setAvailableSlots={setAvailableSlots} deliveryOptions={deliveryOptions} setDeliveryOptions={setDeliveryOptions} />}
        {currentPage === 'driver-portal' && userRole === 'driver' && <div className="pt-32 pb-20 text-center"><h1 className="text-2xl font-bold">Driver Portal</h1><p>Route optimization and pickup list would be here.</p></div>}
      </main>
      <Footer setPage={setPage} onStaffLogin={handleStaffLogin} />
      <StaffLoginModal isOpen={isStaffLoginOpen} type={staffLoginType} onClose={() => setIsStaffLoginOpen(false)} onLogin={handleStaffLoginSuccess} />
      <CustomerLoginModal isOpen={isCustomerLoginOpen} onClose={() => setIsCustomerLoginOpen(false)} onLogin={handleCustomerLoginSuccess} />
      <Assistant />
    </div>
  );
};

export default App;