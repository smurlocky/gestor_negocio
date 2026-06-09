import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Clock, Plus, Edit3, Trash2,
  Loader2, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight,
  ArrowRightLeft, X, Info
} from 'lucide-react';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ScheduleItem {
  id: string;
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  user?: UserItem;
}

interface ShiftTrade {
  id: string;
  requesting_user_id: string;
  target_user_id: string | null;
  requesting_schedule_id: string;
  target_schedule_id: string | null;
  status: string;
  approved_by_id: string | null;
  created_at: string;
  requesting_user?: UserItem;
  target_user?: UserItem;
  requesting_schedule?: ScheduleItem;
  target_schedule?: ScheduleItem;
}

interface Absence {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: string;
  reason: string | null;
  status: string;
  approved_by_id: string | null;
  user?: UserItem;
}

export const SchedulesManagement: React.FC = () => {
  const { user } = useAuth();
  
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const [employees, setEmployees] = useState<UserItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [trades, setTrades] = useState<ShiftTrade[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sub-tabs: 'board' | 'trades' | 'absences'
  const [activeSubTab, setActiveSubTab] = useState<'board' | 'trades' | 'absences'>('board');

  // Board date navigation state (Weekly start date)
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  });

  // Modal Schedule Form States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'create' | 'edit'>('create');
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);
  const [formUserId, setFormUserId] = useState('');
  const [formShiftDate, setFormShiftDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formNotes, setFormNotes] = useState('');

  // Modal Trade Request States
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [mySchedules, setMySchedules] = useState<ScheduleItem[]>([]);
  const [selectedMyScheduleId, setSelectedMyScheduleId] = useState('');
  const [selectedCoworkerId, setSelectedCoworkerId] = useState('');
  const [coworkerSchedules, setCoworkerSchedules] = useState<ScheduleItem[]>([]);
  const [selectedCoworkerScheduleId, setSelectedCoworkerScheduleId] = useState('');

  // Modal Absence Request States
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceUserId, setAbsenceUserId] = useState('');
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceType, setAbsenceType] = useState('VACATION');
  const [absenceReason, setAbsenceReason] = useState('');

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users/');
      setEmployees(res.data);
    } catch (err) {
      console.error('Falha ao obter colaboradores', err);
    }
  };

  const getWeekRangeString = () => {
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);
    return {
      startStr: formatLocalDate(weekStartDate),
      endStr: formatLocalDate(end)
    };
  };

  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startStr, endStr } = getWeekRangeString();
      const res = await api.get(`/schedules/?start_date=${startStr}&end_date=${endStr}`);
      setSchedules(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar escala de turnos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTradesAndAbsences = async () => {
    try {
      const trRes = await api.get('/schedules/trades');
      setTrades(trRes.data);

      const abRes = await api.get('/schedules/absences');
      setAbsences(abRes.data);
    } catch (err) {
      console.error('Falha ao obter dados de trocas/afastamentos', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchSchedules();
    fetchTradesAndAbsences();
  }, [weekStartDate]);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Weekly Navigation
  const handlePrevWeek = () => {
    const prev = new Date(weekStartDate);
    prev.setDate(prev.getDate() - 7);
    setWeekStartDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(weekStartDate);
    next.setDate(next.getDate() + 7);
    setWeekStartDate(next);
  };

  // Render weekly headers YYYY-MM-DD to display
  const getWeekDates = () => {
    const dates = [];
    const temp = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Find shift for employee on specific date (YYYY-MM-DD)
  const findShift = (userId: string, dateStr: string) => {
    return schedules.find(s => s.user_id === userId && s.shift_date === dateStr);
  };

  // Schedule Save handler (POST/PUT)
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        user_id: formUserId,
        shift_date: formShiftDate,
        start_time: formStartTime,
        end_time: formEndTime,
        notes: formNotes || null
      };

      if (scheduleMode === 'create') {
        await api.post('/schedules/', payload);
        triggerSuccess('Turno atribuído com sucesso!');
      } else {
        await api.put(`/schedules/${editingSchedId}`, payload);
        triggerSuccess('Escala atualizada com sucesso!');
      }

      setShowScheduleModal(false);
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar escala. Verifique férias ou conflitos.');
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja remover este turno?')) return;
    setError(null);
    try {
      await api.delete(`/schedules/${id}`);
      triggerSuccess('Turno removido com sucesso!');
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao remover turno.');
    }
  };

  // Load requester own schedules to submit a trade request
  const handleOpenTradeRequest = async () => {
    setSelectedMyScheduleId('');
    setSelectedCoworkerId('');
    setSelectedCoworkerScheduleId('');
    setCoworkerSchedules([]);
    
    try {
      // Get requester schedules for the upcoming week
      const { startStr, endStr } = getWeekRangeString();
      const res = await api.get(`/schedules/?start_date=${startStr}&end_date=${endStr}`);
      // Filter only requester schedules
      setMySchedules(res.data.filter((s: ScheduleItem) => s.user_id === user?.id));
      setShowTradeModal(true);
    } catch (err) {
      console.error('Falha ao carregar turnos próprios', err);
    }
  };

  // Load coworker schedules when coworker selected in trade form
  const handleCoworkerChange = async (coworkerId: string) => {
    setSelectedCoworkerId(coworkerId);
    setSelectedCoworkerScheduleId('');
    if (!coworkerId) {
      setCoworkerSchedules([]);
      return;
    }
    try {
      const { startStr, endStr } = getWeekRangeString();
      const res = await api.get(`/schedules/?start_date=${startStr}&end_date=${endStr}`);
      setCoworkerSchedules(res.data.filter((s: ScheduleItem) => s.user_id === coworkerId));
    } catch (err) {
      console.error('Falha ao obter escalas do colega', err);
    }
  };

  const handleSaveTradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        requesting_schedule_id: selectedMyScheduleId,
        target_user_id: selectedCoworkerId || null,
        target_schedule_id: selectedCoworkerScheduleId || null
      };

      await api.post('/schedules/trades', payload);
      triggerSuccess('Solicitação de troca enviada para avaliação dos gerentes!');
      setShowTradeModal(false);
      fetchTradesAndAbsences();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao solicitar troca.');
    }
  };

  // Manager trade decisions (APPROVE / REJECT)
  const handleTradeDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setError(null);
    try {
      await api.put(`/schedules/trades/${id}`, { status: decision });
      triggerSuccess(decision === 'APPROVED' 
        ? 'Troca de Turno APROVADA! Responsabilidades trocadas automaticamente!' 
        : 'Troca de Turno rejeitada.'
      );
      fetchTradesAndAbsences();
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar decisão de troca.');
    }
  };

  // Absence creation (Leaves, vacations)
  const handleSaveAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        user_id: absenceUserId || user?.id, // prefill user if employee requested, else select
        start_date: absenceStartDate,
        end_date: absenceEndDate,
        type: absenceType,
        reason: absenceReason || null
      };

      await api.post('/schedules/absences', payload);
      triggerSuccess('Ausência/Afastamento registrado! Qualquer turno conflitante foi removido do quadro.');
      setShowAbsenceModal(false);
      fetchTradesAndAbsences();
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao registrar afastamento.');
    }
  };

  // Manager Approve/Reject Leave requests
  const handleAbsenceDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setError(null);
    try {
      await api.put(`/schedules/absences/${id}`, { status: decision });
      triggerSuccess(decision === 'APPROVED'
        ? 'Afastamento APROVADO! Turnos conflitantes limpos automaticamente do quadro.'
        : 'Pedido de afastamento rejeitado.'
      );
      fetchTradesAndAbsences();
      fetchSchedules();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao processar afastamento.');
    }
  };

  const getAbsenceBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'APPROVED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-red-400 bg-red-500/10 border-red-500/20';
    }
  };

  const getAbsenceTypeLabel = (type: string) => {
    switch (type) {
      case 'VACATION': return 'Férias';
      case 'MEDICAL_LEAVE': return 'Licença Médica';
      case 'ABSENCE': return 'Falta justificada';
      default: return 'Outros afastamentos';
    }
  };

  const isManager = user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.role === 'SUPERVISOR';

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Sub tabs switches */}
      <div className="flex border-b border-white/5 pb-1">
        <button
          onClick={() => setActiveSubTab('board')}
          className={`px-6 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 ${
            activeSubTab === 'board' 
              ? 'border-purple-500 text-purple-400 font-bold' 
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Quadro de Horários
        </button>

        <button
          onClick={() => setActiveSubTab('trades')}
          className={`px-6 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 ${
            activeSubTab === 'trades' 
              ? 'border-purple-500 text-purple-400 font-bold' 
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Central de Trocas
        </button>

        <button
          onClick={() => setActiveSubTab('absences')}
          className={`px-6 py-2.5 text-xs font-semibold tracking-wider transition-all border-b-2 ${
            activeSubTab === 'absences' 
              ? 'border-purple-500 text-purple-400 font-bold' 
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Férias & Afastamentos
        </button>
      </div>

      {/* ==========================================
          SUB TAB 1: BOARD / CALENDAR VIEW
          ========================================== */}
      {activeSubTab === 'board' && (
        <div className="space-y-6">
          
          {/* Controls calendar bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrevWeek}
                className="p-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 rounded-xl transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>

              <span className="text-xs font-bold text-white font-mono px-3 py-1 bg-white/5 border border-white/5 rounded-xl">
                {weekStartDate.toLocaleDateString('pt-BR')} até {new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 6)).toLocaleDateString('pt-BR')}
              </span>

              <button 
                onClick={handleNextWeek}
                className="p-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 rounded-xl transition-all"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="flex gap-3">
              {isManager ? (
                <button
                  onClick={() => {
                    setScheduleMode('create');
                    setEditingSchedId(null);
                    setFormUserId('');
                    setFormShiftDate(formatLocalDate(weekStartDate));
                    setFormStartTime('08:00');
                    setFormEndTime('16:00');
                    setFormNotes('');
                    setShowScheduleModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-900/10 flex items-center gap-2 text-xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Escalar Colaborador</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenTradeRequest}
                  className="px-4 py-2.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/25 text-purple-400 font-bold rounded-2xl transition-all text-xs flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Solicitar Troca de Turno</span>
                </button>
              )}
            </div>
          </div>

          {/* Legenda de Cores e Status explicativa */}
          <div className="flex flex-wrap items-center justify-start gap-x-6 gap-y-2.5 px-6 py-3.5 bg-white/[0.02] border border-white/5 rounded-2xl text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[9px] text-white/50 flex items-center gap-1.5 mr-2">
              <Info className="w-3.5 h-3.5 text-purple-400" />
              Legenda de Escalas:
            </span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-lg bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 border border-purple-500/30 shadow-sm shadow-purple-500/10" />
              <span>Turno Regular Escalado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-lg bg-amber-500/15 border border-amber-500/30 shadow-sm shadow-amber-500/10" />
              <span>Troca / Afastamento Pendente</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 shadow-sm shadow-emerald-500/10" />
              <span>Troca / Afastamento Aprovado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-lg bg-red-500/15 border border-red-500/30 shadow-sm shadow-red-500/10" />
              <span>Solicitação Rejeitada</span>
            </div>
          </div>

          {/* Grid weekly timetable calendar */}
          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                <span className="text-sm">Buscando quadro de horários...</span>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-500">Nenhum colaborador cadastrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01] text-xs">
                      <th className="px-6 py-4 font-bold text-muted-foreground w-48">Colaborador</th>
                      {weekDates.map((d, idx) => {
                        const weekdayStr = d.toLocaleDateString('pt-BR', { weekday: 'short' });
                        return (
                          <th key={idx} className="px-4 py-4 text-center">
                            <p className="text-muted-foreground uppercase text-[9px] font-bold tracking-wider">{weekdayStr}</p>
                            <p className="text-white text-xs font-mono font-bold mt-0.5">{d.getDate()}</p>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-white/[0.005] transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-white truncate max-w-[150px]">{emp.name}</p>
                            <span className="text-[10px] text-muted-foreground capitalize">{emp.role.toLowerCase()}</span>
                          </div>
                        </td>
                        
                        {weekDates.map((d, idx) => {
                          const dateStr = formatLocalDate(d);
                          const shift = findShift(emp.id, dateStr);

                          return (
                            <td key={idx} className="p-2.5 text-center min-w-[110px]">
                              {shift ? (
                                <div className="p-3 bg-gradient-to-tr from-purple-600/10 to-indigo-600/10 border border-purple-500/20 rounded-2xl relative group hover:border-purple-500/40 transition-all select-none">
                                  
                                  {/* Shift hours times */}
                                  <p className="font-bold font-mono text-purple-400 flex items-center justify-center gap-1">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span>{shift.start_time}-{shift.end_time}</span>
                                  </p>

                                  {shift.notes && (
                                    <p className="text-[10px] text-muted-foreground truncate mt-1 max-w-[100px]" title={shift.notes}>
                                      {shift.notes}
                                    </p>
                                  )}

                                  {/* Hover manager controls */}
                                  {isManager && (
                                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity">
                                      <button
                                        onClick={() => {
                                          setScheduleMode('edit');
                                          setEditingSchedId(shift.id);
                                          setFormUserId(shift.user_id);
                                          setFormShiftDate(shift.shift_date);
                                          setFormStartTime(shift.start_time);
                                          setFormEndTime(shift.end_time);
                                          setFormNotes(shift.notes || '');
                                          setShowScheduleModal(true);
                                        }}
                                        className="p-1.5 bg-white/5 border border-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      
                                      <button
                                        onClick={() => handleDeleteSchedule(shift.id)}
                                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // Clickable empty cell for managers to quickly schedule
                                isManager ? (
                                  <div 
                                    onClick={() => {
                                      setScheduleMode('create');
                                      setEditingSchedId(null);
                                      setFormUserId(emp.id);
                                      setFormShiftDate(dateStr);
                                      setFormStartTime('08:00');
                                      setFormEndTime('16:00');
                                      setFormNotes('');
                                      setShowScheduleModal(true);
                                    }}
                                    className="h-10 border border-dashed border-white/5 rounded-2xl hover:border-purple-500/30 hover:bg-purple-500/[0.01] transition-all cursor-pointer flex items-center justify-center text-muted-foreground hover:text-purple-400 group"
                                  >
                                    <Plus className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                  </div>
                                ) : (
                                  <div className="h-10 border border-dashed border-white/5 rounded-2xl opacity-10" />
                                )
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          SUB TAB 2: TRADE REQUESTS CENTER
          ========================================== */}
      {activeSubTab === 'trades' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Solicitações de trocas e coberturas de turnos ativos</span>
            
            <button
              onClick={handleOpenTradeRequest}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-900/10 flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Solicitar Troca</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trades.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-slate-500 text-sm rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
                Nenhuma solicitação de troca de turno registrada no momento.
              </div>
            ) : (
              trades.map((t) => (
                <div key={t.id} className="p-6 rounded-2xl flex flex-col justify-between group transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                >
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-purple-600/10 text-purple-400 rounded-lg">
                          <ArrowRightLeft className="w-4 h-4" />
                        </span>
                        <p className="text-xs font-semibold text-white">Solicitação #{t.id.substring(0, 8)}</p>
                      </div>

                      <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-semibold ${
                        t.status === 'PENDING' 
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                          : t.status === 'APPROVED' 
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                      }`}>
                        {t.status === 'PENDING' ? 'Pendente' : t.status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                    </div>

                    {/* Trade visual details compare card */}
                    <div className="grid grid-cols-11 gap-2 items-center p-4 bg-black/40 border border-white/5 rounded-2xl mb-4 text-xs">
                      
                      {/* Left: Requesting shift */}
                      <div className="col-span-5 space-y-1">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Oferecido por</p>
                        <p className="font-bold text-white truncate">{t.requesting_user?.name}</p>
                        {t.requesting_schedule ? (
                          <div className="font-mono text-[10px] text-purple-400 pt-1">
                            <p>{new Date(t.requesting_schedule.shift_date).toLocaleDateString('pt-BR')}</p>
                            <p className="font-bold mt-0.5">{t.requesting_schedule.start_time} - {t.requesting_schedule.end_time}</p>
                          </div>
                        ) : (
                          <p className="text-red-400">Escala removida</p>
                        )}
                      </div>

                      {/* Swap Arrows */}
                      <div className="col-span-1 flex justify-center text-muted-foreground shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-purple-400 shrink-0" />
                      </div>

                      {/* Right: Target shift or coworker */}
                      <div className="col-span-5 space-y-1 pl-1">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Assumido por</p>
                        <p className="font-bold text-white truncate">{t.target_user?.name || 'Qualquer colega'}</p>
                        {t.target_schedule ? (
                          <div className="font-mono text-[10px] text-purple-400 pt-1">
                            <p>{new Date(t.target_schedule.shift_date).toLocaleDateString('pt-BR')}</p>
                            <p className="font-bold mt-0.5">{t.target_schedule.start_time} - {t.target_schedule.end_time}</p>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground italic pt-1">
                            {t.target_user ? 'Substituição simples (Sem troca)' : 'Qualquer escala aceitável'}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {t.status === 'PENDING' && isManager && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleTradeDecision(t.id, 'REJECTED')}
                        className="flex-1 py-2 bg-white/5 hover:bg-red-500/5 active:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-white/5 hover:border-red-500/10 rounded-xl text-xs font-semibold transition-all"
                      >
                        Rejeitar
                      </button>

                      <button
                        onClick={() => handleTradeDecision(t.id, 'APPROVED')}
                        className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                      >
                        Aprovar Swap
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ==========================================
          SUB TAB 3: ABSENCES / VACATION PLANNER
          ========================================== */}
      {activeSubTab === 'absences' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Planejador de férias, licenças médicas e ausências justificadas</span>
            
            <button
              onClick={() => {
                setAbsenceUserId('');
                setAbsenceStartDate('');
                setAbsenceEndDate('');
                setAbsenceType('VACATION');
                setAbsenceReason('');
                setShowAbsenceModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-900/10 flex items-center gap-2 text-xs transition-all hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Afastamento</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {absences.length === 0 ? (
              <div className="col-span-3 p-12 text-center text-slate-500 text-sm rounded-2xl" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
                Nenhum afastamento ou planejamento de férias cadastrado.
              </div>
            ) : (
              absences.map((ab) => (
                <div key={ab.id} className="p-5 rounded-2xl flex flex-col justify-between group transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-md">
                          {getAbsenceTypeLabel(ab.type)}
                        </span>
                        <h4 className="text-base font-bold text-white mt-2 leading-tight truncate max-w-[150px]">
                          {ab.user?.name}
                        </h4>
                      </div>

                      <span className={`px-2 py-0.5 border rounded-full text-[9px] font-semibold ${getAbsenceBadge(ab.status)}`}>
                        {ab.status === 'PENDING' ? 'Pendente' : ab.status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                    </div>

                    <div className="py-3 border-y border-white/5 mb-4 text-xs font-mono text-white space-y-1.5">
                      <p><span className="text-muted-foreground uppercase text-[9px] tracking-wider font-bold block mb-0.5">Início:</span> {new Date(ab.start_date).toLocaleDateString('pt-BR')}</p>
                      <p><span className="text-muted-foreground uppercase text-[9px] tracking-wider font-bold block mb-0.5">Fim:</span> {new Date(ab.end_date).toLocaleDateString('pt-BR')}</p>
                    </div>

                    {ab.reason && (
                      <p className="text-xs text-muted-foreground italic truncate max-w-[200px] mb-4" title={ab.reason}>
                        Observação: "{ab.reason}"
                      </p>
                    )}
                  </div>

                  {ab.status === 'PENDING' && isManager && (
                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => handleAbsenceDecision(ab.id, 'REJECTED')}
                        className="flex-1 py-1.5 bg-white/5 hover:bg-red-500/5 active:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-white/5 rounded-xl text-[10px] font-semibold transition-all"
                      >
                        Rejeitar
                      </button>

                      <button
                        onClick={() => handleAbsenceDecision(ab.id, 'APPROVED')}
                        className="flex-1 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 hover:text-purple-300 border border-purple-500/20 rounded-xl text-[10px] font-bold transition-all"
                      >
                        Aprovar
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT WORK SHIFT SCHEDULE */}
      {showScheduleModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-md shadow-2xl relative"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {scheduleMode === 'create' ? 'Atribuir Turno de Trabalho' : 'Editar Escala do Colaborador'}
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Agende datas e horários operacionais do time.</p>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Colaborador Escalado
                </label>
                <select
                  required
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm appearance-none"
                >
                  <option value="" className="bg-slate-900 text-muted-foreground">Selecione...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Data da Escala
                </label>
                <input
                  type="date"
                  required
                  value={formShiftDate}
                  onChange={(e) => setFormShiftDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Hora Início (HH:MM)
                  </label>
                  <input
                    type="text"
                    required
                    pattern="^[0-2][0-9]:[0-5][0-9]$"
                    placeholder="08:00"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Hora Fim (HH:MM)
                  </label>
                  <input
                    type="text"
                    required
                    pattern="^[0-2][0-9]:[0-5][0-9]$"
                    placeholder="16:00"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Observações
                </label>
                <input
                  type="text"
                  placeholder="Ex: Turno Noturno, Reforço de Caixa"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none text-sm"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                >
                  Confirmar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SHIFT TRADE REQUEST (SWAP SUBMIT) */}
      {showTradeModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-md shadow-2xl relative"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setShowTradeModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Solicitar Troca de Turno</h3>
            <p className="text-xs text-muted-foreground mb-6">Ofereça um de seus turnos em troca de outro turno de um colega.</p>

            <form onSubmit={handleSaveTradeRequest} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sua Escala a ser cedida
                </label>
                <select
                  required
                  value={selectedMyScheduleId}
                  onChange={(e) => setSelectedMyScheduleId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-xs appearance-none"
                >
                  <option value="" className="bg-slate-900 text-muted-foreground">Selecione seu turno...</option>
                  {mySchedules.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {new Date(s.shift_date).toLocaleDateString('pt-BR')} ({s.start_time} às {s.end_time})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Colega Substituto
                </label>
                <select
                  required
                  value={selectedCoworkerId}
                  onChange={(e) => handleCoworkerChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-xs appearance-none"
                >
                  <option value="" className="bg-slate-900 text-muted-foreground">Selecione o colega...</option>
                  {employees.filter(emp => emp.id !== user?.id).map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.name}</option>
                  ))}
                </select>
              </div>

              {selectedCoworkerId && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Escala do Colega a receber em troca (Opcional)
                  </label>
                  <select
                    value={selectedCoworkerScheduleId}
                    onChange={(e) => setSelectedCoworkerScheduleId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-xs appearance-none"
                  >
                    <option value="" className="bg-slate-900 text-muted-foreground">Substituição simples (Sem troca de turno)...</option>
                    {coworkerSchedules.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                        {new Date(s.shift_date).toLocaleDateString('pt-BR')} ({s.start_time} às {s.end_time})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTradeModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                >
                  Confirmar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ABSENCE / VACATION REQUEST FORM */}
      {showAbsenceModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl w-full max-w-md shadow-2xl relative"
            style={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <button
              onClick={() => setShowAbsenceModal(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Registrar Afastamento ou Férias</h3>
            <p className="text-xs text-muted-foreground mb-6">
              {isManager 
                ? 'Registre períodos de férias ou licenças médicas. Os turnos coincidentes serão removidos automaticamente.'
                : 'Solicite períodos de folgas ou férias. A solicitação ficará pendente para aprovação dos gerentes.'}
            </p>

            <form onSubmit={handleSaveAbsence} className="space-y-4">
              
              {isManager && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Colaborador Afastado
                  </label>
                  <select
                    required
                    value={absenceUserId}
                    onChange={(e) => setAbsenceUserId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm appearance-none"
                  >
                    <option value="" className="bg-slate-900 text-muted-foreground">Selecione...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    required
                    value={absenceStartDate}
                    onChange={(e) => setAbsenceStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    required
                    value={absenceEndDate}
                    onChange={(e) => setAbsenceEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Tipo de Afastamento
                </label>
                <select
                  value={absenceType}
                  onChange={(e) => setAbsenceType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white focus:outline-none text-sm appearance-none"
                >
                  <option value="VACATION" className="bg-slate-900 text-white">Férias Programadas</option>
                  <option value="MEDICAL_LEAVE" className="bg-slate-900 text-white">Licença Médica</option>
                  <option value="ABSENCE" className="bg-slate-900 text-white">Falta Justificada</option>
                  <option value="OTHER" className="bg-slate-900 text-white">Outros Motivos</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Motivo / Observações
                </label>
                <input
                  type="text"
                  placeholder="Ex: Atestado de Gripe, Férias de Verão"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 focus:border-purple-500/30 rounded-2xl text-white placeholder-muted-foreground focus:outline-none text-sm"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAbsenceModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold rounded-2xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-purple-900/10 transition-all"
                >
                  {isManager ? 'Registrar Lançamento' : 'Confirmar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
