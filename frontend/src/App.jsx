import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/documentApi.js';
import './App.css';

const DEFAULT_USER_ID = 'usuario-local-1';
const USER_ID_STORAGE_KEY = 'dms-user-id';

function readStoredUserId() {
  try {
    return window.localStorage.getItem(USER_ID_STORAGE_KEY) || DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export default function App() {
  const [userId, setUserId] = useState(readStoredUserId);
  const [userIdInput, setUserIdInput] = useState(userId);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    try {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    } catch {}

    setIsLoading(true);
    setError('');

    listDocuments(userId)
      .then((items) => {
        if (isCurrent) {
          setDocuments(items);
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.message);
          setDocuments([]);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [userId, reloadKey]);

  async function handleUpload(file) {
    const createdDocument = await uploadDocument(file, userId);
    setDocuments((currentDocuments) => [createdDocument, ...currentDocuments]);
    setNotice('Documento enviado.');
    return createdDocument;
  }

  function handleUserSubmit(event) {
    event.preventDefault();
    const nextUserId = userIdInput.trim();
    if (!nextUserId) {
      setError('Informe um identificador.');
      return;
    }

    setError('');
    setNotice('');
    setDocuments([]);
    setUserId(nextUserId);
  }

  function handleRefresh() {
    setNotice('');
    setReloadKey((currentKey) => currentKey + 1);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-name">DMS<span>/</span></span>
        </a>
        <span className="workspace-label">ARQUIVO PESSOAL</span>
        <form className="identity-form" onSubmit={handleUserSubmit}>
          <label htmlFor="user-id">Identidade</label>
          <input
            id="user-id"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            autoComplete="off"
            maxLength={100}
          />
          <button type="submit" aria-label="Aplicar identidade">Aplicar</button>
        </form>
      </header>

      <main className="workspace" id="main">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">ESPAÇO DE TRABALHO <span>01</span></p>
            <h1 id="page-title">Seus documentos<span className="heading-period">.</span></h1>
          </div>
          <div className="heading-meta">
            <span className="status-dot" aria-hidden="true" />
            <span>Armazenamento local</span>
          </div>
        </section>

        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {notice && <p className="notice notice-success" role="status">{notice}</p>}

        <div className="content-grid">
          <aside className="upload-panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <span className="section-index">01 / ENTRADA</span>
              <span className="panel-mark" aria-hidden="true">+</span>
            </div>
            <h2 id="upload-title">Adicionar arquivo</h2>
            <UploadComponent onUpload={handleUpload} />
          </aside>

          <section className="documents-section" aria-labelledby="documents-title">
            <div className="documents-heading">
              <div>
                <span className="section-index">02 / COLEÇÃO</span>
                <h2 id="documents-title">Documentos</h2>
              </div>
              <div className="list-actions">
                <span className="document-count" aria-label={`${documents.length} documentos`}>
                  {String(documents.length).padStart(2, '0')}
                </span>
                <button className="refresh-button" type="button" onClick={handleRefresh} disabled={isLoading}>
                  Atualizar
                </button>
              </div>
            </div>
            <DocumentList documents={documents} isLoading={isLoading} userId={userId} />
          </section>
        </div>
        <footer className="workspace-footer">
          <span>DMS <span className="footer-separator">/</span> DOCUMENTOS</span>
          <span>IDENTIDADE ATIVA <strong>{userId}</strong></span>
        </footer>
      </main>
    </div>
  );
}
