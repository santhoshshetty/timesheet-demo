import { Navigate, type RouteObject } from 'react-router';
import { ProjectCreatePage } from '../features/projects/ProjectCreatePage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { ProjectEditPage } from '../features/projects/ProjectEditPage';
import { ProjectListPage } from '../features/projects/ProjectListPage';
import { App } from './App';
import { NotFoundPage } from './NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: 'projects', element: <ProjectListPage /> },
      { path: 'projects/new', element: <ProjectCreatePage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'projects/:projectId/edit', element: <ProjectEditPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
