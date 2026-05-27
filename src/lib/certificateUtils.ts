import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { CertificateTemplate } from '../components/CertificateDesigner';

interface ParticipantData {
  id?: string;
  nome: string;
  dataConclusao: string;
  titulo: string;
  cargaHoraria?: string;
}

export const generateCertificatePDF = async (
  template: CertificateTemplate,
  participant: ParticipantData
): Promise<void> => {
  // Parse date for day and month
  let dd = '';
  let mm = '';
  if (participant.dataConclusao) {
    const parts = participant.dataConclusao.split('/');
    if (parts.length === 3) {
      dd = parts[0];
      // Get month name if it's a standard DD/MM/YYYY
      const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      mm = dateObj.toLocaleString('pt-BR', { month: 'long' });
    }
  }

  // Load image to get dimensions and ensure it's ready
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Erro ao carregar imagem de fundo do certificado.'));
    img.src = template.backgroundImage;
  });

  const imgWidth = img.width;
  const imgHeight = img.height;
  const aspectRatio = imgWidth / imgHeight;

  // Create a hidden div to render the certificate
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  
  // A4 dimensions at 96dpi: 793.7 x 1122.5
  // We'll use 1122.5 as the base for landscape, or 793.7 as base for portrait
    if (aspectRatio >= 1) {
      container.style.width = '1122.5px';
      container.style.height = `${1122.5 / aspectRatio}px`;
    } else {
      container.style.height = '1122.5px';
      container.style.width = `${1122.5 * aspectRatio}px`;
    }
    
    container.style.backgroundColor = 'white';
    container.style.backgroundImage = `url(${template.backgroundImage})`;
    container.style.backgroundSize = '100% 100%';
    container.style.backgroundRepeat = 'no-repeat';
    container.style.backgroundPosition = 'center';
    container.style.fontFamily = 'Inter, sans-serif';

    // Prepare fields promises (some fields like QR Code might need async generation)
    const fieldPromises = template.fields.map(async (field) => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = `${field.x}%`;
      el.style.top = `${field.y}%`;
      el.style.transform = 'translate(-50%, -50%)';
      el.style.fontSize = `${field.fontSize * 1.33}px`;
      el.style.color = field.color;
      el.style.fontWeight = field.fontWeight;
      el.style.fontFamily = field.fontFamily;
      el.style.whiteSpace = 'nowrap';
      el.style.zIndex = '10';

      if (field.type === 'qrcode') {
        const validationUrl = `${window.location.origin}/validar/${participant.id || 'temp'}`;
        try {
          const qrDataUrl = await QRCode.toDataURL(validationUrl, {
            margin: 1,
            width: field.fontSize * 4, // Scale QR code relative to "font size"
            color: {
              dark: field.color || '#000000',
              light: '#ffffff00' // Transparent background
            }
          });
          
          const qrImg = document.createElement('img');
          qrImg.src = qrDataUrl;
          qrImg.style.width = `${field.fontSize * 4}px`;
          qrImg.style.height = `${field.fontSize * 4}px`;
          
          const qrContainer = document.createElement('div');
          qrContainer.className = 'flex flex-col items-center gap-1';
          qrContainer.appendChild(qrImg);
          
          const label = document.createElement('span');
          label.innerText = 'VALIDAÇÃO DIGITAL';
          label.style.fontSize = '8px';
          label.style.fontWeight = 'bold';
          qrContainer.appendChild(label);
          
          el.appendChild(qrContainer);
        } catch (err) {
          console.error('Error generating QR code:', err);
        }
      } else {
        let text = '';
        switch (field.type) {
          case 'name': text = participant.nome; break;
          case 'date': text = participant.dataConclusao; break;
          case 'title': text = participant.titulo; break;
          case 'workload': text = participant.cargaHoraria || ''; break;
          case 'day': text = dd; break;
          case 'month': text = mm; break;
          case 'custom': text = field.text || ''; break;
        }
        el.innerText = text;
      }
      
      container.appendChild(el);
    });

    await Promise.all(fieldPromises);

    document.body.appendChild(container);

  try {
    // Wait a short moment for fonts/text rendering to settle
    await new Promise(r => setTimeout(r, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: aspectRatio >= 1 ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(`Certificado_${participant.nome.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Error generating certificate:', error);
    alert('Erro ao gerar certificado. Verifique sua conexão ou a imagem de fundo.');
  } finally {
    document.body.removeChild(container);
  }
};
