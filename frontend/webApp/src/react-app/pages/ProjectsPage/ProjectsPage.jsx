import { useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useCreateProjectMutation, useDeleteProjectMutation, useGetProjectsQuery, useUpdateProjectMutation } from '../../features/worktrack/worktrackApi.js';
import './ProjectsPage.css';

const EMPTY_FORM = { name: '', address: '', description: '' };

export function ProjectsPage() {
  const { t } = useI18n();
  const { data, error, isLoading } = useGetProjectsQuery();
  const [createProject, createState] = useCreateProjectMutation();
  const [updateProject, updateState] = useUpdateProjectMutation();
  const [deleteProject, deleteState] = useDeleteProjectMutation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [mutatingProjectIds, setMutatingProjectIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const activeProjectCount = projects.filter(project => project.isActive).length;
  const isFormMutating = createState.isLoading || (updateState.isLoading && mutatingProjectIds.length === 0);

  function updateForm(field, value) { setForm(current => ({ ...current, [field]: value })); }
  function openCreate() { setEditingId(''); setForm(EMPTY_FORM); setActionError(''); setActionSuccess(''); setModalOpen(true); }
  function startEdit(project) { setEditingId(project.id); setForm({ name: project.name || '', address: project.address || '', description: project.description || '' }); setActionError(''); setActionSuccess(''); setModalOpen(true); }
  function closeModal() { if (!isFormMutating) { setModalOpen(false); setEditingId(''); setForm(EMPTY_FORM); setActionError(''); } }
  function openDelete(project) { setModalOpen(false); setActionError(''); setActionSuccess(''); setDeleteCandidate(project); }
  function closeDelete() { if (!deleteState.isLoading) { setDeleteCandidate(null); setActionError(''); } }

  async function submitProject(event) {
    event.preventDefault(); setActionError('');
    try {
      if (editingId) await updateProject({ projectId: editingId, ...form }).unwrap();
      else await createProject(form).unwrap();
      closeModal();
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  async function toggleProjectStatus(project) {
    if (mutatingProjectIds.includes(project.id)) return;
    setActionError('');
    setActionSuccess('');
    setMutatingProjectIds(current => [...current, project.id]);
    try { await updateProject({ projectId: project.id, isActive: !project.isActive }).unwrap(); }
    catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
    finally { setMutatingProjectIds(current => current.filter(id => id !== project.id)); }
  }

  async function confirmDeleteProject() {
    if (!deleteCandidate) return;
    setActionError('');
    try {
      await deleteProject(deleteCandidate.id).unwrap();
      setDeleteCandidate(null);
      setEditingId('');
      setForm(EMPTY_FORM);
      setActionSuccess(t('projects.deleted'));
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return <section className="projectsPage pageStack">
    <header className="projectsHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('projects.eyebrow')}</p><h1>{t('projects.title')}</h1><p>{error ? t('projects.loadError') : t('projects.activeTotal', { active: activeProjectCount, total: projects.length })}</p></div><button className="projectsAddTop" type="button" onClick={openCreate}>+ {t('projects.new')}</button></header>
    {actionSuccess ? <p className="statusNote is-success">{actionSuccess}</p> : null}
    {actionError && !modalOpen && !deleteCandidate ? <p className="statusNote is-error">{actionError}</p> : null}
    <section className="projectsList screenCard"><div className="compactHeader"><h2>{t('projects.list')}</h2><p>{t('projects.listCopy')}</p></div>
      {isLoading ? <RequestLoadingState label={t('projects.loading')} /> : null}
      {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
      {!isLoading && !error && !projects.length ? <div className="projectsEmpty"><span aria-hidden="true"><SvgIcon name="location" /></span><strong>{t('projects.empty')}</strong></div> : null}
      {projects.length ? <div className="projectsCards">{projects.map(project => { const isProjectMutating = mutatingProjectIds.includes(project.id); return <article className={`projectCard${project.isActive ? '' : ' is-inactive'}`} key={project.id}>
        <button className="projectCard-open" type="button" disabled={isProjectMutating} onClick={() => startEdit(project)}><span className="projectCard-icon" aria-hidden="true"><SvgIcon name="location" /></span><span className="projectCard-copy"><strong>{project.name}</strong><small>{project.address || project.description || t('projects.noDetails')}</small></span><span className={`projectStatus ${project.isActive ? 'is-active' : ''}`}>{project.isActive ? t('projects.active') : t('projects.inactive')}</span><span className="projectCard-chevron">›</span></button>
        <button className={`projectQuickStatus ${project.isActive ? 'is-deactivate' : 'is-activate'}`} type="button" disabled={isProjectMutating} onClick={() => toggleProjectStatus(project)}>{project.isActive ? t('projects.deactivate') : t('projects.reactivate')}</button>
      </article>; })}</div> : null}
    </section>

    {modalOpen ? <div className="projectsModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}><section className="projectsModal" role="dialog" aria-modal="true"><header><div><span>{t('projects.eyebrow')}</span><h2>{editingId ? t('projects.edit') : t('projects.new')}</h2></div><button type="button" onClick={closeModal} aria-label={t('projects.cancel')}>×</button></header><form className="projectsForm" onSubmit={submitProject}><p>{t('projects.copy')}</p><label className="projectsField"><span>{t('projects.name')}</span><input type="text" value={form.name} onChange={event => updateForm('name', event.target.value)} required /></label><label className="projectsField"><span>{t('projects.address')}</span><input type="text" value={form.address} onChange={event => updateForm('address', event.target.value)} /></label><label className="projectsField"><span>{t('projects.description')}</span><textarea value={form.description} onChange={event => updateForm('description', event.target.value)} /></label>{actionError ? <p className="statusNote is-error">{actionError}</p> : null}<div className={`projectsFormActions${editingId ? ' has-delete' : ''}`}>{editingId ? <button className="projectsDangerOutline" type="button" onClick={() => openDelete(projects.find(project => project.id === editingId) || { id: editingId, name: form.name })}>{t('projects.delete')}</button> : null}<button type="button" onClick={closeModal}>{t('projects.cancel')}</button><button className="projectsPrimaryButton" type="submit" disabled={isFormMutating}>{editingId ? t('projects.save') : t('projects.create')}</button></div></form></section></div> : null}

    {deleteCandidate ? <div className="projectsModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDelete(); }}><section className="projectsModal projectsDeleteModal" role="dialog" aria-modal="true"><header><div><span>{t('projects.eyebrow')}</span><h2>{t('projects.deleteTitle')}</h2></div><button type="button" disabled={deleteState.isLoading} onClick={closeDelete} aria-label={t('projects.cancel')}>×</button></header><div className="projectsForm"><p>{t('projects.deleteCopy', { name: deleteCandidate.name || t('projects.title') })}</p><p className="projectsDeleteWarning">{t('projects.deleteWarning')}</p>{actionError ? <p className="statusNote is-error">{actionError}</p> : null}<div className="projectsFormActions"><button type="button" disabled={deleteState.isLoading} onClick={closeDelete}>{t('projects.cancel')}</button><button className="projectsDangerButton" type="button" disabled={deleteState.isLoading} onClick={confirmDeleteProject}>{deleteState.isLoading ? t('projects.deleting') : t('projects.confirmDelete')}</button></div></div></section></div> : null}
  </section>;
}
