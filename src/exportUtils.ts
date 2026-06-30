import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReferralRecord } from './types';
import { cleanPhone } from './utils';

export const exportToExcel = (records: ReferralRecord[]) => {
  const data = records.flatMap(record => 
    (record.contacts || []).map(contact => ({
      'Cliente': record.clientName,
      'CPF Cliente': record.clientCpf,
      'Barbeiro': record.barberName,
      'Lead': contact.name,
      'Telefone': contact.phone,
      'Status': contact.called ? 'Chamado' : 'Pendente',
      'Assinatura': contact.subscriptionClosed ? 'Fechada' : 'Pendente',
      'Data Cadastro': new Date(record.createdAt).toLocaleDateString('pt-BR')
    }))
  );

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
  XLSX.writeFile(workbook, "leads_barbearia.xlsx");
};

export const exportToPDF = (records: ReferralRecord[]) => {
  const doc = new jsPDF();
  
  const tableData = records.flatMap(record => 
    (record.contacts || []).map(contact => [
      record.clientName,
      record.barberName,
      contact.name,
      contact.phone,
      contact.called ? 'Chamado' : 'Pendente',
      contact.subscriptionClosed ? 'Fechada' : 'Pendente'
    ])
  );

  autoTable(doc, {
    head: [['Cliente', 'Barbeiro', 'Lead', 'Telefone', 'Status', 'Assinatura']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [225, 6, 0] }, // OWN Barber Club Red
    theme: 'grid',
  });

  doc.save('leads_barbearia.pdf');
};

export const exportGroupToPDF = (clientName: string, clientCpf: string, batches: ReferralRecord[]) => {
  const doc = new jsPDF();

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(225, 6, 0); // OWN Barber Club Red
  doc.text("RELATÓRIO DE INDICAÇÕES", 14, 20);

  // Subtitle / Info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 27);

  // Divider Line
  doc.setDrawColor(225, 6, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // Client Info Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Indicador (Lead Mestre):", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${clientName} (CPF: ${clientCpf})`, 14, 48);

  // Table of referred leads
  const tableData = batches.flatMap(batch => 
    (batch.contacts || []).map(contact => {
      // Format status
      let statusText = 'Pendente';
      if (contact.subscriptionClosed) {
        statusText = 'Assinatura Fechada';
      } else if (contact.status === 'converted') {
        statusText = 'Convertido';
      } else if (contact.status === 'contacted') {
        statusText = 'Contatado';
      } else if (contact.status === 'scheduled') {
        statusText = 'Agendado';
      } else if (contact.status === 'no_response') {
        statusText = 'Sem Retorno';
      } else if (contact.status === 'declined') {
        statusText = 'Recusado';
      } else if (contact.status === 'invalid_number') {
        statusText = 'Número Inválido';
      } else if (contact.called) {
        statusText = 'Chamado';
      }
      
      return [
        contact.name,
        contact.phone,
        batch.barberName,
        statusText,
        contact.notes || '-'
      ];
    })
  );

  autoTable(doc, {
    startY: 55,
    head: [['Nome do Lead', 'Telefone', 'Barbeiro Responsável', 'Status ROI', 'Observações']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [225, 6, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: 30 },
      4: { cellWidth: 'auto' }
    }
  });

  // Save the PDF
  const sanitizedClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`leads_${sanitizedClientName}.pdf`);
};
