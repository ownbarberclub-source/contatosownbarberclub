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
