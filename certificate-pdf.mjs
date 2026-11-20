import PDFDocument from 'pdfkit';

const dateFormat = new Intl.DateTimeFormat('es-VE', {dateStyle: 'long', timeZone: 'America/Caracas'});

export async function renderCertificatePdf(certificate, qr, emblem) {
  const pdf = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 56,
    info: {Title: 'Certificado de aprobación', Author: 'Protección Civil Táchira'},
  });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  const navy = '#122345';
  const center = {align: 'center'};
  const imageCentered = (source, y, size) => pdf.image(source, (pdf.page.width - size) / 2, y, {width: size});
  const date = value => dateFormat.format(new Date(value));

  pdf.roundedRect(27, 27, pdf.page.width - 54, pdf.page.height - 54, 8).lineWidth(2).stroke(navy);
  imageCentered(emblem, 52, 62);
  pdf.y = 126;
  pdf.fillColor(navy).font('Helvetica-Bold').fontSize(13)
    .text('Instituto Autónomo de Protección Civil del Estado Táchira', center);
  pdf.moveDown(.65).fontSize(28).text('Certificado de aprobación', center);
  pdf.moveDown(.5).fontSize(23).text(certificate.name, center);
  pdf.moveDown(.5).fontSize(17).text(certificate.title, center);
  pdf.moveDown(.75).font('Helvetica').fontSize(11)
    .text('Emisión: ' + date(certificate.issued) + '   |   Vencimiento: ' + date(certificate.expires), center);
  pdf.moveDown(.7).text('Código de verificación: ' + certificate.code, center);
  imageCentered(qr, pdf.y + 8, 82);

  pdf.addPage();
  pdf.fillColor(navy).font('Helvetica-Bold').fontSize(24).text('Contenido programático');
  pdf.moveDown(.55).fontSize(16).text(certificate.title);
  pdf.moveDown(.35).font('Helvetica').fontSize(11).text('Certificado ' + certificate.code);
  if (certificate.program.summary) {
    pdf.moveDown().fontSize(12).text(certificate.program.summary);
  }
  pdf.moveDown();
  const topics = certificate.program.topics;
  if (topics.length) {
    pdf.fontSize(12);
    topics.forEach((topic, index) => pdf.text(`${index + 1}. ${topic}`, {lineGap: 4}));
  } else {
    pdf.text('Temario no disponible en el registro del curso.');
  }
  pdf.end();
  return result;
}
