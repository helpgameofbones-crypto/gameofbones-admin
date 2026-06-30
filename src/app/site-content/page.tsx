'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://syuostlqzzinigqwjzap.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dW9zdGxxenppbmlncXdqemFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA3MzIsImV4cCI6MjA4OTQyNjczMn0.BKf4EF2QhNcW_u1SVVbtiGdlnzdthiptlVcNk3gP2KU'
);

const SECTIONS = [
  { key: 'hero_image', label: 'Homepage Hero Image', desc: 'The main hero image next to "Real Food. Real Dogs."' },
  { key: 'bestseller_image', label: 'Bestseller Section Image', desc: 'Image shown in the bestseller/featured section' },
  { key: 'foods_to_avoid_infographic', label: 'Foods to Never Give Infographic', desc: 'Visual guide of toxic foods for the Feeders page' },
  { key: 'feeding_guide_image', label: 'Feeding Guide Image', desc: 'Image for the feeding guide section' },
];

export default function SiteContentPage() {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => { fetchContent(); }, []);
  async function fetchContent() { setLoading(true); const { data } = await supabase.from('site_content').select('*').order('section'); setContent(data || []); setLoading(false); }

  function getContent(section: string) { return content.find(c => c.section === section); }

  async function uploadImage(section: string, file: File) {
    setUploading(section);
    const name = `site/${section}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('product-images').upload(name, file, { contentType: file.type, upsert: true });
    if (error) { alert('Upload failed: ' + error.message); setUploading(null); return; }
    const url = `https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/${name}`;
    const existing = getContent(section);
    if (existing) { await supabase.from('site_content').update({ image_url: url }).eq('id', existing.id); }
    else { await supabase.from('site_content').insert({ section, image_url: url, title: section, is_active: true }); }
    setUploading(null); fetchContent();
  }

  async function removeImage(section: string) {
    const existing = getContent(section);
    if (existing) { await supabase.from('site_content').update({ image_url: null }).eq('id', existing.id); fetchContent(); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Site Content</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Manage images and content shown on the website</p>

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
                <img src={item.image_url} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb' }} />
                <label style={{ position: 'absolute', bottom: 8, right: 8, background: '#1a1008', color: '#fff', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Replace
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadImage(sec.key, e.target.files[0]); }} />
                </label>
              </div>
            ) : (
              <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: 6, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontWeight: 600, marginTop: 8, color: '#374151' }}>{uploading === sec.key ? 'Uploading...' : 'Click to upload image'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>PNG, JPG, WebP</div>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadImage(sec.key, e.target.files[0]); }} />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
