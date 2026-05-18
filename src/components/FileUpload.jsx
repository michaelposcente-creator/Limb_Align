import { useRef, useState } from 'react';

export default function FileUpload({ onFile, fileName }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['stl', 'obj'].includes(ext)) {
      alert('Please upload an STL or OBJ file.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      className={`file-upload-zone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="upload-icon">📂</div>
      <p>Drop file here or click to browse</p>
      <p className="formats">STL · OBJ</p>
      {fileName && <p className="file-name">✓ {fileName}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.obj"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}
