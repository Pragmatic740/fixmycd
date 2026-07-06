import React from 'react';

// Action Bar Icons
const UpvoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
);

const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default function DashboardPage() {
  // Mock data for the MVP feed
  const reports = [
    { 
      id: '1', 
      user: 'Sarah J.', 
      handle: '@sarahj_civic', 
      time: '2h', 
      title: 'Deep Pothole on 4th St', 
      category: 'Roads & Potholes', 
      desc: 'Large pothole causing flat tires. Avoid the right lane near the intersection. Multiple cars hit it this morning.', 
      status: 'Submitted',
      statusClass: 'submitted',
      upvotes: 42,
      comments: 12
    },
    { 
      id: '2', 
      user: 'Mike T.', 
      handle: '@miket_local', 
      time: '5h', 
      title: 'Traffic Light Out', 
      category: 'Signals', 
      desc: 'Main intersection light is completely out, 4-way stop in effect. Very dangerous during rush hour.', 
      status: 'In Review',
      statusClass: 'in-review',
      upvotes: 128,
      comments: 34
    },
    { 
      id: '3', 
      user: 'Elena R.', 
      handle: '@elena_reports', 
      time: '1d', 
      title: 'Graffiti on Park Wall', 
      category: 'Vandalism', 
      desc: 'Offensive graffiti found on the east wall of the community park near the playground.', 
      status: 'In Progress',
      statusClass: 'in-progress',
      upvotes: 15,
      comments: 3
    },
    { 
      id: '4', 
      user: 'David W.', 
      handle: '@davidw99', 
      time: '2d', 
      title: 'Burst Water Main', 
      category: 'Water', 
      desc: 'Water is gushing out of the sidewalk near the library. Flooding the street.', 
      status: 'Resolved',
      statusClass: 'resolved',
      upvotes: 256,
      comments: 89
    }
  ];

  return (
    <>
      <div className="feed-header">
        <h2>Local Feed</h2>
      </div>
      
      <div>
        {reports.map(report => (
          <article key={report.id} className="report-card">
            <div className="report-card-header">
              <div className="report-avatar">
                {report.user.charAt(0)}
              </div>
              <div className="report-user-info">
                <span className="display-name">{report.user}</span>{' '}
                <span className="handle">{report.handle}</span>
              </div>
              <div className="report-timestamp">{report.time}</div>
            </div>
            
            <div style={{ paddingLeft: '52px' }}>
              <div>
                <span className={`report-badge ${report.statusClass}`}>
                  {report.status}
                </span>
                <span className="report-category">{report.category}</span>
              </div>
              
              <h3 className="report-title">{report.title}</h3>
              <p className="report-desc">{report.desc}</p>
              
              <div className="report-actions">
                <button className="action-btn">
                  <UpvoteIcon /> {report.upvotes}
                </button>
                <button className="action-btn">
                  <CommentIcon /> {report.comments}
                </button>
                <button className="action-btn">
                  <ShareIcon />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Floating Action Button for Mobile */}
      <button className="fab" aria-label="Report Issue">
        <PlusIcon />
      </button>
    </>
  );
}
