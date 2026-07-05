export default function Home() {
  // Mock data for the 20 person MVP feed simulating location-based radius
  const reports = [
    { id: '1', title: 'Deep Pothole on 4th St', category: 'Roads & Potholes', distance: '0.2 km away', desc: 'Large pothole causing flat tires. Avoid the right lane.', status: 'Submitted' },
    { id: '2', title: 'Traffic Light Out', category: 'Signals', distance: '0.5 km away', desc: 'Main intersection light is completely out, 4-way stop in effect.', status: 'In Review' },
    { id: '3', title: 'Graffiti on Park Wall', category: 'Vandalism', distance: '1.1 km away', desc: 'Offensive graffiti found on the east wall of the community park.', status: 'Shortlisted' },
    { id: '4', title: 'Burst Water Main', category: 'Water', distance: '2.0 km away', desc: 'Water is gushing out of the sidewalk near the library.', status: 'In Progress' },
    { id: '5', title: 'Fallen Tree Branch', category: 'Parks', distance: '2.4 km away', desc: 'Large branch blocking the pedestrian path near the lake.', status: 'Submitted' }
  ];

  return (
    <>
      <div className="header">
        <h2>Local Feed (2.5km radius)</h2>
      </div>
      
      <div>
        {reports.map(report => (
          <div key={report.id} className="report-card">
            <div className="report-status">{report.status}</div>
            <h3 className="report-title">{report.title}</h3>
            <div className="report-meta">{report.category} • {report.distance}</div>
            <p className="report-desc">{report.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
