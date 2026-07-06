import Link from 'next/link';
import React from 'react';

// Reusable SVG Icons for the navigation
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ExploreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-container">
      {/* Left Sidebar Navigation */}
      <aside className="app-sidebar">
        <Link href="/" className="app-sidebar-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        <nav className="app-nav">
          <Link href="/dashboard" className="app-nav-link active">
            <HomeIcon /> <span>Home</span>
          </Link>
          <Link href="/dashboard/explore" className="app-nav-link">
            <ExploreIcon /> <span>Explore</span>
          </Link>
          <Link href="/dashboard/notifications" className="app-nav-link">
            <BellIcon /> <span>Notifications</span>
          </Link>
          <Link href="/dashboard/profile" className="app-nav-link">
            <UserIcon /> <span>Profile</span>
          </Link>
        </nav>
        <button className="btn-primary">Report Issue</button>
      </aside>
      
      {/* Main Feed Content */}
      <main className="app-main">
        {children}
      </main>
      
      {/* Right Sidebar (Trending) */}
      <aside className="app-right-sidebar">
        <div className="trending-box">
          <h3>Trending in your District</h3>
          <div className="trending-item">
            <div className="trending-category">Potholes</div>
            <div className="trending-topic">Main Street crater reported by 12 people</div>
          </div>
          <div className="trending-item">
            <div className="trending-category">Street Lights</div>
            <div className="trending-topic">Oak Ave blackout entering day 3</div>
          </div>
          <div className="trending-item">
            <div className="trending-category">Water</div>
            <div className="trending-topic">Water main break resolved on 5th Ave</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
