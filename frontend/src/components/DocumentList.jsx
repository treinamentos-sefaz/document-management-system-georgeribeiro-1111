import DownloadButton from './DownloadButton.jsx';
import { formatFileSize } from '../utils/formatFileSize.js';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatUploadDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : dateFormatter.format(date);
}

export default function DocumentList({ documents, isLoading, userId }) {
  if (isLoading) {
    return <p className="list-state" role="status">Carregando documentos...</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-index" aria-hidden="true">00</span>
        <p>Nenhum documento encontrado.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="document-table">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Tamanho</th>
            <th scope="col">Enviado</th>
            <th scope="col"><span className="visually-hidden">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td className="document-name" title={document.originalName}>{document.originalName}</td>
              <td className="document-size">{formatFileSize(document.size)}</td>
              <td className="document-date">{formatUploadDate(document.uploadedAt)}</td>
              <td className="document-action">
                <DownloadButton document={document} userId={userId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}