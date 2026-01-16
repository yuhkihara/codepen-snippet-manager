export default function HealthPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Health Check</h1>
      <p>Status: OK</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}