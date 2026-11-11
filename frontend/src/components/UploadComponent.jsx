import { useId, useRef, useState } from 'react';
import { formatFileSize } from '../utils/formatFileSize.js';

export default function UploadComponent({ onUpload }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onUpload(file);
      setFile(null);
      inputRef.current.value = '';
    } catch (uploadError) {
      setError(uploadError.message || 'Não foi possível enviar o documento.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFileChange(event) {
    setFile(event.target.files?.[0] || null);
    setError('');
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="visually-hidden"
        id={inputId}
        type="file"
        onChange={handleFileChange}
      />
      <label className="file-picker" htmlFor={inputId}>
        <span className="picker-symbol" aria-hidden="true">↥</span>
        <span>Escolher arquivo</span>
      </label>
      <div className="selected-file" aria-live="polite">
        {file ? (
          <>
            <span className="selected-name" title={file.name}>{file.name}</span>
            <span className="selected-size">{formatFileSize(file.size)}</span>
          </>
        ) : (
          <span className="selected-placeholder">Nenhum arquivo selecionado</span>
        )}
      </div>
      {error && <p className="component-error" role="alert">{error}</p>}
      <button className="upload-submit" type="submit" disabled={!file || isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Enviar documento'}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}