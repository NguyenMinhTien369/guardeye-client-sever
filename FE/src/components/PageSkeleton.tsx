export function PageSkeleton() {
  return (
    <div className="skeleton-wrapper">
      {/* Top Banner Skeleton */}
      <div className="skeleton-card" style={{ height: '140px', marginBottom: '1rem' }}></div>
      
      {/* Grid Content Skeleton */}
      <div className="skeleton-grid">
        <div className="skeleton-item"></div>
        <div className="skeleton-item"></div>
        <div className="skeleton-item"></div>
        <div className="skeleton-item"></div>
      </div>
      
      {/* Additional full width row */}
      <div className="skeleton-card" style={{ height: '200px', marginTop: '1rem' }}></div>
    </div>
  );
}
