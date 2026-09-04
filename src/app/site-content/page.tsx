'use client';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/app/lib/authedFetch'

// Only include sections that actually have a real spot on the storefront.
// "Bestseller Section Image" was removed — the homepage never had a dedicated
// image slot for it, so uploads there were invisible on the live site.
const SECTIONS = [
  { key: 'hero_image', label: 'Homepage Hero Image', desc: 'The main hero image next to "Real Food. Real Dogs."', aspect: '380/440' },
  { key: 'foods_to_avoid_infographic', label: 'Foods to Never Give Infographic', desc: 'Visual guide of toxic foods, shown on the Feeders page', aspect: '1/1' },
];

export default function SiteContentPage() {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => { fetchContent(); }, []);
  async function fetchContent() { setLoading(true); const response = await authedFetch('/api/admin/content?resource=site'); const payload = await response.json().catch(() => ({})); setContent(response.ok ? payload.items || [] : []); setLoading(false); }

  function getContent(section: string) { return content.find(c => c.section === section); }

  async function uploadImage(section: string, file: File) {
    setUploading(section);
    const data = new FormData(); data.append('resource', 'site'); data.append('file', file);
    const upload = await authedFetch('/api/admin/content', { method: 'POST', body: data });
    const uploadPayload = await upload.json().catch(() => ({}));
    if (!upload.ok) { alert('Upload failed: ' + (uploadPayload.error || 'Please try again.')); setUploading(null); return; }
    const url = uploadPayload.url;
    const existing = getContent(section);
    const save = await authedFetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'site', id: existing?.id, section, image_url: url }) });
    if (!save.ok) { alert('Save failed. Please try again.'); setUploading(null); return; }
    setUploading(null);
    fetchContent();
  }

  async function removeImage(section: string) {
    const existing = getContent(section);
    if (existing) { await authedFetch('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'site', id: existing.id, section, image_url: null }) }); fetchContent(); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Site Content</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Manage images shown on the website</p>

      {loading ? <p>Loading...</p> : SECTIONS.map(sec => {
        const item = getContent(sec.key);
        return (
          <div key={sec.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{sec.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{sec.desc}</div>
              </div>
              {item?.image_url && (
                <button onClick={() => removeImage(sec.key)} style={{ padding: '4px 10px', border: '1px solid #fecaca', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>Remove</button>
              )}
            </div>
            {item?.image_url ? (
              <div style={{ position: 'relative' }}>
                {/* object-fit: cover + explicit height so the preview always visibly fills its box,
                    matching exactly how the image will appear live on the website. */}
                <img src={item.image_url} style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', display: 'block' }} />
                <label style={{ position: 'absolute', bottom: 8, right: 8, background: '#1a1008', color: '#fff', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {uploading === sec.key ? 'Uploading...' : 'Replace'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading === sec.key} onChange={e => { if (e.target.files?.[0]) uploadImage(sec.key, e.target.files[0]); }} />
                </label>
              </div>
            ) : (
              <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: 6, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontWeight: 600, marginTop: 8, color: '#374151' }}>{uploading === sec.key ? 'Uploading...' : 'Click to upload image'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>PNG, JPG, WebP</div>
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading === sec.key} onChange={e => { if (e.target.files?.[0]) uploadImage(sec.key, e.target.files[0]); }} />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
