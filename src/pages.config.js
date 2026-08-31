/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Analytics from './pages/Analytics';
import ApproveQuote from './pages/ApproveQuote';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Calendar from './pages/Calendar';
import CancelSubscription from './pages/CancelSubscription';
import Checkout from './pages/Checkout';
import ChaseInvoice from './pages/ChaseInvoice';
import Clients from './pages/Clients';
import Contact from './pages/Contact';
import CreateInvoice from './pages/CreateInvoice';
import CreateQuote from './pages/CreateQuote';
import Dashboard from './pages/Dashboard';
import Features from './pages/Features';
import Home from './pages/Home';
import BatchInvoices from './pages/BatchInvoices';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoicePaymentSuccess from './pages/InvoicePaymentSuccess';
import Invoices from './pages/Invoices';
import JobPhotos from './pages/JobPhotos';
import PaymentPlans from './pages/PaymentPlans';
import PaymentSuccess from './pages/PaymentSuccess';
import PhoneVerification from './pages/PhoneVerification';
import Pricing from './pages/Pricing';
import PublicBooking from './pages/PublicBooking';
import PublicQuote from './pages/PublicQuote';
import QuickInvoice from './pages/QuickInvoice';
import QuickQuote from './pages/QuickQuote';
import QuoteDetail from './pages/QuoteDetail';
import Quotes from './pages/Quotes';
import RecurringInvoices from './pages/RecurringInvoices';
import Settings from './pages/Settings';
import Team from './pages/Team';
import Timesheet from './pages/Timesheet';
import AcceptCrewInvite from './pages/AcceptCrewInvite';
import SharedPhotos from './pages/SharedPhotos';
import Sitemap from './pages/Sitemap';
import TermsOfService from './pages/TermsOfService';
import TestCheckout from './pages/TestCheckout';
import UpgradeRequired from './pages/UpgradeRequired';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "ApproveQuote": ApproveQuote,
    "Blog": Blog,
    "BlogPost": BlogPost,
    "Calendar": Calendar,
    "CancelSubscription": CancelSubscription,
    "ChaseInvoice": ChaseInvoice,
    "Clients": Clients,
    "Contact": Contact,
    "CreateInvoice": CreateInvoice,
    "CreateQuote": CreateQuote,
    "Dashboard": Dashboard,
    "Features": Features,
    "Home": Home,
    "BatchInvoices": BatchInvoices,
    "InvoiceDetail": InvoiceDetail,
    "InvoicePaymentSuccess": InvoicePaymentSuccess,
    "Invoices": Invoices,
    "JobPhotos": JobPhotos,
    "PaymentPlans": PaymentPlans,
    "PaymentSuccess": PaymentSuccess,
    "PhoneVerification": PhoneVerification,
    "Checkout": Checkout,
    "Pricing": Pricing,
    "PublicBooking": PublicBooking,
    "PublicQuote": PublicQuote,
    "QuickInvoice": QuickInvoice,
    "QuickQuote": QuickQuote,
    "QuoteDetail": QuoteDetail,
    "Quotes": Quotes,
    "RecurringInvoices": RecurringInvoices,
    "Settings": Settings,
    "Team": Team,
    "Timesheet": Timesheet,
    "AcceptCrewInvite": AcceptCrewInvite,
    "SharedPhotos": SharedPhotos,
    "Sitemap": Sitemap,
    "TermsOfService": TermsOfService,
    "TestCheckout": TestCheckout,
    "UpgradeRequired": UpgradeRequired,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};