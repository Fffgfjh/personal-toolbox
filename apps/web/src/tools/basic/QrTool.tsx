import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

export function QrTool() {
  const [text, setText] = useState('https://example.com');
  const [size, setSize] = useState(320);
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      try {
        setDataUrl(await QRCode.toDataURL(text || ' ', { width: size, margin: 2, errorCorrectionLevel: 'M' }));
        setError('');
      } catch (qrError) {
        setError(qrError instanceof Error ? qrError.message : '二维码生成失败。');
      }
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [size, text]);

  return (
    <div className="qr-layout">
      <div className="control-card">
        <label>内容<textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
        <label>尺寸：{size}px<input type="range" min="160" max="1024" step="16" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
      </div>
      <div className="qr-preview">
        {dataUrl && <img src={dataUrl} alt="生成的二维码" />}
        <a className="primary-button inline-button" href={dataUrl} download="qrcode.png"><Download size={17} /> 下载 PNG</a>
        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
