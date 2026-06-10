export function LoadingSpinner() {
  return (
    <div className="loading-screen">
      <div className="spinner-container">
        <div className="spinner" />
        <p className="spinner-text">Đang tải...</p>
      </div>
    </div>
  );
}
