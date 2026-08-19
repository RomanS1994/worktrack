import { useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import {
  useCreateProjectMutation,
  useGetProjectsQuery,
  useUpdateProjectMutation,
} from '../../features/worktrack/worktrackApi.js';
import './ProjectsPage.css';

const EMPTY_FORM = {
  name: '',
  address: '',
  description: '',
};

export function ProjectsPage() {
  const { data, error, isLoading } = useGetProjectsQuery();
  const [createProject, createState] = useCreateProjectMutation();
  const [updateProject, updateState] = useUpdateProjectMutation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [actionError, setActionError] = useState('');
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const activeProjectCount = projects.filter(project => project.isActive).length;
  const isMutating = createState.isLoading || updateState.isLoading;

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function startEdit(project) {
    setEditingId(project.id);
    setForm({
      name: project.name || '',
      address: project.address || '',
      description: project.description || '',
    });
    setActionError('');
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
  }

  async function submitProject(event) {
    event.preventDefault();
    setActionError('');
    try {
      if (editingId) {
        await updateProject({ projectId: editingId, ...form }).unwrap();
      } else {
        await createProject(form).unwrap();
      }
      resetForm();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function toggleProjectStatus(project) {
    setActionError('');
    try {
      await updateProject({ projectId: project.id, isActive: !project.isActive }).unwrap();
      if (editingId === project.id && project.isActive) resetForm();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return (
    <section className="projectsPage pageStack">
      <header className="projectsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Worksites</p>
          <h1>Projects</h1>
          <p>{error ? 'Unable to load projects' : `${activeProjectCount} active · ${projects.length} total`}</p>
        </div>
      </header>

      <section className="projectsWorkspace">
        <form className="projectsForm screenCard" onSubmit={submitProject}>
          <div className="compactHeader">
            <h2>{editingId ? 'Edit project' : 'New project'}</h2>
            <p>Projects keep employee hours scoped to the current company.</p>
          </div>

          <label className="projectsField">
            <span>Name</span>
            <input type="text" value={form.name} onChange={event => updateForm('name', event.target.value)} />
          </label>
          <label className="projectsField">
            <span>Address</span>
            <input type="text" value={form.address} onChange={event => updateForm('address', event.target.value)} />
          </label>
          <label className="projectsField">
            <span>Description</span>
            <textarea value={form.description} onChange={event => updateForm('description', event.target.value)} />
          </label>

          {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

          <div className="projectsFormActions">
            {editingId ? <button type="button" onClick={resetForm}>Cancel</button> : null}
            <button className="projectsPrimaryButton" type="submit" disabled={isMutating}>
              {editingId ? 'Save project' : 'Create project'}
            </button>
          </div>
        </form>

        <section className="projectsList screenCard">
          <div className="compactHeader">
            <h2>Project list</h2>
            <p>Inactive projects stay available for history and can be reactivated.</p>
          </div>

          {isLoading ? <RequestLoadingState label="Loading projects" /> : null}
          {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

          {!isLoading && !error && !projects.length ? (
            <div className="projectsEmpty">
              <span aria-hidden="true"><SvgIcon name="location" /></span>
              <strong>No projects yet</strong>
            </div>
          ) : null}

          {projects.length ? (
            <div className="projectsCards">
              {projects.map(project => (
                <article className={`projectCard${project.isActive ? '' : ' is-inactive'}`} key={project.id}>
                  <div className="projectCard-main">
                    <span className="projectCard-icon" aria-hidden="true"><SvgIcon name="location" /></span>
                    <div>
                      <strong>{project.name}</strong>
                      <p>{project.address || project.description || 'No details'}</p>
                    </div>
                  </div>
                  <span className={`projectStatus ${project.isActive ? 'is-active' : ''}`}>
                    {project.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <div className="projectCard-actions">
                    <button type="button" onClick={() => startEdit(project)}>Edit</button>
                    <button
                      className={project.isActive ? 'is-deactivate' : 'is-activate'}
                      type="button"
                      disabled={isMutating}
                      onClick={() => toggleProjectStatus(project)}
                    >
                      {project.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </section>
  );
}
