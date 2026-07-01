import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReferralRecord, Seller, Plan } from './types';

// Helper to format ROI status in PT-BR
const formatROIStatus = (status?: string, subscriptionClosed?: boolean, called?: boolean): string => {
  const cStatus = status || (subscriptionClosed ? 'converted' : called ? 'contacted' : 'pending');
  switch (cStatus) {
    case 'converted': return 'Assinou ✅';
    case 'scheduled': return 'Agendou 📅';
    case 'frequent': return 'Frequente';
    case 'invalid_number': return 'Número não existe';
    case 'declined': return 'Recusou';
    case 'no_response': return 'Não Respondeu';
    case 'contacted': return 'Contatado';
    default: return 'Pendente';
  }
};

// Helper to format Fidelimax status in PT-BR
const formatFidelimaxStatus = (status?: string): string => {
  const fStatus = status || 'pending';
  switch (fStatus) {
    case 'launched': return 'Lançado ✅';
    case 'not_applicable': return 'Não se aplica 🚫';
    default: return 'Pendente';
  }
};

export const exportToExcel = (records: ReferralRecord[], sellers: Seller[]) => {
  const data = records.flatMap(record => 
    (record.contacts || []).map(contact => {
      const seller = sellers.find(s => s.id === contact.sellerId);
      return {
        'Indicador': record.clientName,
        'CPF Indicador': record.clientCpf,
        'Lead': contact.name,
        'Telefone': contact.phone,
        'Barbeiro': record.barberName,
        'Vendedor': seller ? seller.name : 'Sem Vendedor',
        'Status ROI': formatROIStatus(contact.status, contact.subscriptionClosed, contact.called),
        'Status Fidelimax': formatFidelimaxStatus(contact.fidelimaxStatus),
        'Data Cadastro': new Date(record.createdAt).toLocaleDateString('pt-BR')
      };
    })
  );

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
  XLSX.writeFile(workbook, "leads_barbearia.xlsx");
};

export const exportToPDF = (records: ReferralRecord[], sellers: Seller[]) => {
  const doc = new jsPDF({ orientation: 'landscape' }); // Landscape format works better for 8 columns
  
  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(225, 6, 0); // OWN Barber Club Red
  doc.text("RELATÓRIO GERAL DE LEADS", 14, 15);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 21);

  const tableData = records.flatMap(record => 
    (record.contacts || []).map(contact => {
      const seller = sellers.find(s => s.id === contact.sellerId);
      return [
        record.clientName,
        contact.name,
        contact.phone,
        record.barberName,
        seller ? seller.name : 'Sem Vendedor',
        formatROIStatus(contact.status, contact.subscriptionClosed, contact.called),
        formatFidelimaxStatus(contact.fidelimaxStatus),
        new Date(record.createdAt).toLocaleDateString('pt-BR')
      ];
    })
  );

  autoTable(doc, {
    startY: 26,
    head: [['Indicador', 'Lead', 'Telefone', 'Barbeiro', 'Vendedor', 'Status ROI', 'Status Fidelimax', 'Data Cadastro']],
    body: tableData,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [225, 6, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    theme: 'grid',
  });

  doc.save('leads_barbearia.pdf');
};

export const exportGroupToPDF = (clientName: string, clientCpf: string, batches: ReferralRecord[], sellers: Seller[]) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(225, 6, 0); // OWN Barber Club Red
  doc.text("RELATÓRIO DE INDICAÇÕES", 14, 15);

  // Subtitle / Info
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 21);

  // Divider Line
  doc.setDrawColor(225, 6, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 25, 282, 25);

  // Client Info Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("Indicador (Lead Mestre):", 14, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${clientName} (CPF: ${clientCpf})`, 14, 38);

  const tableData = batches.flatMap(batch => 
    (batch.contacts || []).map(contact => {
      const seller = sellers.find(s => s.id === contact.sellerId);
      return [
        contact.name,
        contact.phone,
        batch.barberName,
        seller ? seller.name : 'Sem Vendedor',
        formatROIStatus(contact.status, contact.subscriptionClosed, contact.called),
        formatFidelimaxStatus(contact.fidelimaxStatus),
        new Date(batch.createdAt).toLocaleDateString('pt-BR')
      ];
    })
  );

  autoTable(doc, {
    startY: 44,
    head: [['Nome do Lead', 'Telefone', 'Barbeiro Responsável', 'Vendedor', 'Status ROI', 'Status Fidelimax', 'Data Cadastro']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [225, 6, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    theme: 'grid',
  });

  const sanitizedClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`leads_${sanitizedClientName}.pdf`);
};

export const exportGroupToPDFAdmin = (clientName: string, clientCpf: string, batches: ReferralRecord[], sellers: Seller[], plans: Plan[]) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(225, 6, 0); // OWN Barber Club Red
  doc.text("RELATÓRIO ADMINISTRATIVO DE INDICAÇÕES", 14, 15);

  // Subtitle / Info
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 21);

  // Divider Line
  doc.setDrawColor(225, 6, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 25, 282, 25);

  // Client Info Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("Indicador (Lead Mestre):", 14, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${clientName} (CPF: ${clientCpf})`, 14, 38);

  const tableData = batches.flatMap(batch => 
    (batch.contacts || []).map(contact => {
      const seller = sellers.find(s => s.id === contact.sellerId);
      const plan = plans.find(p => p.id === contact.planId);
      const isConverted = contact.status === 'converted' || contact.subscriptionClosed;
      
      return [
        contact.name,
        contact.phone,
        batch.barberName,
        seller ? seller.name : 'Sem Vendedor',
        formatROIStatus(contact.status, contact.subscriptionClosed, contact.called),
        formatFidelimaxStatus(contact.fidelimaxStatus),
        isConverted && plan ? plan.name : '-',
        isConverted && contact.activationDate ? new Date(contact.activationDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
        isConverted && contact.cardNumber ? contact.cardNumber : '-',
        new Date(batch.createdAt).toLocaleDateString('pt-BR')
      ];
    })
  );

  autoTable(doc, {
    startY: 44,
    head: [['Nome do Lead', 'Telefone', 'Barbeiro', 'Vendedor', 'Status ROI', 'Status Fidelimax', 'Plano', 'Ativação', 'Nº Cartão', 'Data Cadastro']],
    body: tableData,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' }, // Dark Admin Style
    theme: 'grid',
  });

  const sanitizedClientName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`leads_admin_${sanitizedClientName}.pdf`);
};
