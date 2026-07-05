import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FixMyDistrict',
  description: 'Report and track infrastructure failures in your district.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <aside className="sidebar">
            <h1>FixMyDistrict</h1>
            <nav>
              <a href="/">Home</a>
              <a href="/explore">Explore</a>
              <a href="/notifications">Notifications</a>
              <a href="/profile">Profile</a>
            </nav>
            <button className="post-button">Report Issue</button>
          </aside>
          
          <main className="main-feed">
            {children}
          </main>
          
          <aside className="right-sidebar">
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
      </body>
    </html>
  );
}
