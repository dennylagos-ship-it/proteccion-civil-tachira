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
  const orange = '#e87524';
  const center = {align: 'center'};
  const date = value => dateFormat.format(new Date(value));
  const width = pdf.page.width;
  const height = pdf.page.height;
  const textCentered = (text, y, size, font='Helvetica', color=navy) => {
    pdf.font(font).fontSize(size).fillColor(color).text(text, 100, y, {width: width-200,...center});
  };

  pdf.rect(0,0,width,height).fill('#faf7f0');
  pdf.rect(0,0,width,24).fill(navy);
  pdf.rect(0,24,width,5).fill(orange);
  pdf.rect(24,43,width-48,height-68).lineWidth(.7).stroke('#ad9e88');
  pdf.image(emblem,(width-64)/2,55,{fit:[64,64],align:'center',valign:'center'});
  textCentered('Instituto Autónomo de Protección Civil del Estado Táchira', 130, 10, 'Helvetica-Bold');
  textCentered('Certificado de aprobación', 153, 40, 'Times-Bold');
  textCentered('Se otorga el presente certificado a', 214, 12);
  textCentered(certificate.name, 237, 30, 'Times-Bold');
  const nameBottom=pdf.y;
  textCentered('Por haber aprobado el curso', nameBottom+12, 12);
  textCentered(certificate.title, pdf.y+4, 18, 'Helvetica-Bold');
  const footerY=height-124;
  pdf.moveTo(60,footerY-15).lineTo(width-60,footerY-15).lineWidth(.7).stroke('#ad9e88');
  pdf.font('Helvetica-Bold').fontSize(9).fillColor(navy).text('EMISIÓN',62,footerY);
  pdf.font('Helvetica').fontSize(11).text(date(certificate.issued),62,footerY+17);
  pdf.font('Helvetica-Bold').fontSize(9).text('VIGENCIA HASTA',228,footerY);
  pdf.font('Helvetica').fontSize(11).text(date(certificate.expires),228,footerY+17);
  pdf.font('Helvetica-Bold').fontSize(9).text('VERIFICACIÓN',width-355,footerY);
  pdf.font('Courier').fontSize(8).text(certificate.code,width-355,footerY+17);
  pdf.image(qr,width-133,footerY-5,{width:72});

  pdf.on('pageAdded', () => {
    pdf.rect(0,0,pdf.page.width,12).fill(navy);
    pdf.rect(0,12,pdf.page.width,3).fill(orange);
    pdf.fillColor(navy);
  });
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
