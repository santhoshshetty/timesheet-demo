import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import type { Project } from '@timesheet/api-contract';
import { Link as RouterLink } from 'react-router';
import { visuallyHidden } from '../../shared/visuallyHidden';
import type { SortField, SortOrder } from './api';
import { ChargeCodeText } from './ChargeCodeText';
import { formatDate } from './format';
import { BILLING_TYPE_LABELS, PROJECT_TYPE_LABELS } from './labels';

interface ProjectTableProps {
  projects: readonly Project[];
  sort: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
}

const SORT_LABELS: Record<SortField, string> = {
  name: 'Project name',
  chargeCode: 'Charge code',
  startDate: 'Start date',
  endDate: 'End date',
};

export function ProjectTable({ projects, sort, order, onSort }: ProjectTableProps) {
  const sortable = (field: SortField) => (
    <TableCell sortDirection={sort === field ? order : false}>
      <TableSortLabel
        active={sort === field}
        direction={sort === field ? order : 'asc'}
        onClick={() => onSort(field)}
      >
        {SORT_LABELS[field]}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <caption style={visuallyHidden}>
          Projects, sorted by {SORT_LABELS[sort].toLowerCase()}{' '}
          {order === 'asc' ? 'ascending' : 'descending'}
        </caption>
        <TableHead>
          <TableRow>
            {sortable('name')}
            {sortable('chargeCode')}
            <TableCell>Project manager</TableCell>
            {sortable('startDate')}
            {sortable('endDate')}
            <TableCell>Project type</TableCell>
            <TableCell>Billing type</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} hover>
              <TableCell>
                <Link component={RouterLink} to={`/projects/${project.id}`}>
                  {project.name}
                </Link>
              </TableCell>
              <TableCell>
                <ChargeCodeText code={project.chargeCode} />
              </TableCell>
              <TableCell>{project.projectManager.name}</TableCell>
              <TableCell>{formatDate(project.startDate)}</TableCell>
              <TableCell>{formatDate(project.endDate)}</TableCell>
              <TableCell>{PROJECT_TYPE_LABELS[project.projectType]}</TableCell>
              <TableCell>{BILLING_TYPE_LABELS[project.billingType]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
